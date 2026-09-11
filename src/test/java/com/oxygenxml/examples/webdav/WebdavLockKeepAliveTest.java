package com.oxygenxml.examples.webdav;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.net.InetSocketAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import ro.sync.ecss.extensions.api.webapp.AuthorDocumentModel;
import ro.sync.ecss.extensions.api.webapp.SessionStore;
import ro.sync.ecss.extensions.api.webapp.WebappAuthorDocumentFactory;
import ro.sync.ecss.extensions.api.webapp.plugin.URLStreamHandlerWithContextUtil;
import ro.sync.ecss.extensions.api.webapp.plugin.UserContext;
import ro.sync.ecss.webapp.access.SessionStoreSetter;
import ro.sync.ecss.webapp.testing.MockAuthorDocumentFactory;
import ro.sync.exml.options.OptionTags;
import ro.sync.exml.options.Options;
import ro.sync.exml.plugin.lock.LockException;
import ro.sync.exml.workspace.api.PluginWorkspaceProvider;
import ro.sync.exml.workspace.api.options.WSOptionsStorage;

/**
 * Tests every combination of the "Lock resources on open" option of this connector and of the Web
 * Author <code>always.send.keepalive</code> server option, asserting for each one whether the
 * document gets locked when it is opened, whether the lock is perpetuated by the keep-alive
 * requests and whether the resource is unlocked when the document model is disposed.
 *
 * <p>Nothing is stubbed here. The plugin is loaded from its own <code>plugin.xml</code>, so the
 * lock handler under test is the very {@link WebdavLockHandler} this connector contributes, found
 * the way Web Author finds it; the documents are built by {@link WebappAuthorDocumentFactory}; and
 * the assertions are made on the WebDAV traffic received by a server listening on localhost.</p>
 *
 * <p>The three moments under test are:</p>
 * <ul>
 *   <li><b>lock on open</b> - <code>BaseAuthorDocumentModel.lockOnOpen()</code>, which asks the
 *   lock manager whether locking is enabled, and so reaches
 *   {@link WebdavLockHandler#isLockEnabled()};</li>
 *   <li><b>periodic refresh</b> - the <code>RESTDocumentManager.keepAlive</code> endpoint calls
 *   <code>WebappLockManager.updateLock()</code> for every keep-alive request the browser sends.
 *   Whether the browser sends them is decided client-side, in <code>editor.js</code>, by
 *   <code>getServerOption('always.send.keepalive') || newDoc.lockingEnabled</code> - which is the
 *   <code>alwaysSendKeepAlive</code> parameter of the tests below;</li>
 *   <li><b>unlock on dispose</b> - <code>AuthorDocumentModel.dispose()</code> calls
 *   <code>WebappLockManager.unlock()</code>.</li>
 * </ul>
 *
 * @author bogdan_dumitru
 */
public class WebdavLockKeepAliveTest {

  /**
   * The content of the document opened by the tests.
   */
  private static final String DOC_CONTENT = "<?xml version=\"1.0\"?><root><p>text</p></root>";

  /**
   * How many keep-alive requests each test simulates.
   */
  private static final int KEEP_ALIVE_REQUESTS = 2;

  /**
   * The timeout the locks are expected to be taken for - the edit timeout of the lock manager.
   */
  private static final int EXPECTED_LOCK_TIMEOUT_SECONDS = 300;

  /**
   * The ID of the user context the document is opened in.
   */
  private static final String CONTEXT_ID = "webdav-lock-keep-alive-test";

  /**
   * The WebDAV server the document is opened from. It locks a single resource and records the
   * lock-related requests it receives.
   */
  private WebdavServerForTests webdavServer;

  /**
   * The HTTP server the WebDAV server above answers on.
   */
  private HttpServer httpServer;

  /**
   * The URL of the document on the WebDAV server, carrying the user context.
   */
  private URL docUrl;

  /**
   * Trusted hosts as they were before the test, restored afterwards.
   */
  private String[] initialTrustedHosts;

  /**
   * Starts a Web Author environment with this plugin loaded in it and the WebDAV server the
   * document is opened from.
   *
   * @throws Exception If it fails.
   */
  @Before
  public void setUp() throws Exception {
    MockAuthorDocumentFactory.initForTest();
    // The session store is installed by the Web Author servlet layer, which is not running here.
    SessionStoreSetter.setSessionStore(new MemorySessionStoreForTests());
    // Loads this plugin the usual way, so that the lock handler and the URL stream handler it
    // contributes are the ones the application uses.
    WebappAuthorDocumentFactory.setPlugins(createPluginsDir());

    Options options = Options.getInstance();
    initialTrustedHosts = options.getStringArrayProperty(OptionTags.TRUSTED_HOSTS);
    options.setStringArrayProperty(OptionTags.TRUSTED_HOSTS, new String[] { "localhost" });

    webdavServer = new WebdavServerForTests();
    httpServer = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    httpServer.createContext("/", webdavServer);
    httpServer.start();

    docUrl = new URL(
        "webdav-http://localhost:" + httpServer.getAddress().getPort() + "/doc.xml");
    URLStreamHandlerWithContextUtil.getInstance().setUserContext(
        new UserContext(new HashMap<String, String>(), CONTEXT_ID), docUrl);
  }

  /**
   * Stops the WebDAV server and restores the options.
   */
  @After
  public void tearDown() {
    if (httpServer != null) {
      httpServer.stop(0);
    }
    if (initialTrustedHosts != null) {
      Options.getInstance().setStringArrayProperty(
          OptionTags.TRUSTED_HOSTS, initialTrustedHosts);
    }
    URLStreamHandlerWithContextUtil.getInstance().clearCacheForTC();
  }

  /**
   * <p><b>Description:</b> With locking enabled the document is locked when it is opened, every
   * keep-alive request refreshes that lock and disposing the document unlocks the resource. The
   * <code>always.send.keepalive</code> option plays no part in it: locking being enabled is enough
   * for the browser to send keep-alive requests.</p>
   *
   * @author bogdan_dumitru
   *
   * @throws Exception If it fails.
   */
  @Test
  public void testLockOnOpenEnabledAndKeepAliveNotForced() throws Exception {
    assertLockingBehavior(true, false, true, true, true);
  }

  /**
   * <p><b>Description:</b> Forcing keep-alive requests on top of enabled locking changes nothing:
   * the same lock is taken on open, refreshed on every keep-alive and released on dispose.</p>
   *
   * @author bogdan_dumitru
   *
   * @throws Exception If it fails.
   */
  @Test
  public void testLockOnOpenEnabledAndKeepAliveForced() throws Exception {
    assertLockingBehavior(true, true, true, true, true);
  }

  /**
   * <p><b>Description:</b> With locking disabled the resource is never locked - and since the
   * document reports <code>lockingEnabled == false</code> to the browser and keep-alive requests
   * are not forced, no keep-alive request is sent either.</p>
   *
   * @author bogdan_dumitru
   *
   * @throws Exception If it fails.
   */
  @Test
  public void testLockOnOpenDisabledAndKeepAliveNotForced() throws Exception {
    assertLockingBehavior(false, false, false, false, false);
  }

  /**
   * <p><b>Description:</b> With locking disabled but keep-alive requests forced, the browser does
   * send keep-alive requests while the document is open. The resource must stay unlocked all the
   * same: the user turned locking off.</p>
   *
   * @author bogdan_dumitru
   *
   * @throws Exception If it fails.
   */
  @Test
  public void testLockOnOpenDisabledAndKeepAliveForced() throws Exception {
    assertLockingBehavior(false, true, false, false, false);
  }

  /**
   * Opens the document from the WebDAV server, asserts the three moments of the lock lifecycle and
   * disposes the document.
   *
   * @param lockOnOpen                Whether the connector locks resources on open.
   * @param alwaysSendKeepAlive       Whether the browser sends keep-alive requests even when
   *                                  locking is disabled for the document.
   * @param expectedLockedOnOpen      Whether the resource is expected to be locked once the
   *                                  document is opened.
   * @param expectedLockRefreshed     Whether the keep-alive requests are expected to lock or
   *                                  refresh the lock.
   * @param expectedUnlockedOnDispose Whether an UNLOCK is expected when the document is disposed.
   *
   * @throws Exception If it fails.
   */
  private void assertLockingBehavior(boolean lockOnOpen, boolean alwaysSendKeepAlive,
      boolean expectedLockedOnOpen, boolean expectedLockRefreshed,
      boolean expectedUnlockedOnDispose) throws Exception {
    setLockingEnabled(lockOnOpen);

    AuthorDocumentModel model = openDocument();
    boolean disposed = false;
    try {
      // 1. Is the document locked when it is opened?
      assertEquals("Locked on open", expectedLockedOnOpen, webdavServer.isLocked());
      assertEquals("LOCK requests received while opening the document",
          expectedLockedOnOpen ? 1 : 0, webdavServer.getLockRequestCount());
      if (expectedLockedOnOpen) {
        assertEquals("The lock is taken for the edit timeout",
            EXPECTED_LOCK_TIMEOUT_SECONDS, webdavServer.getLastLockTimeoutSeconds());
      }

      // 2. Is the lock perpetuated by the keep-alive requests?
      assertEquals("Locking enabled, as reported to the browser",
          lockOnOpen, model.getLockManager().isEnabled());
      boolean browserSendsKeepAlives = alwaysSendKeepAlive || model.getLockManager().isEnabled();

      int locksBeforeKeepAlives = webdavServer.getLockRequestCount();
      if (browserSendsKeepAlives) {
        sendKeepAliveRequests(model);
      }
      assertEquals("LOCK requests received while keeping the document alive",
          expectedLockRefreshed ? KEEP_ALIVE_REQUESTS : 0,
          webdavServer.getLockRequestCount() - locksBeforeKeepAlives);
      assertEquals("Locked after the keep-alive requests",
          expectedLockedOnOpen || expectedLockRefreshed, webdavServer.isLocked());

      // 3. Is the resource unlocked when the document is disposed?
      model.dispose();
      disposed = true;

      assertEquals("UNLOCK requests received while disposing the document",
          expectedUnlockedOnDispose ? 1 : 0, webdavServer.getUnlockRequestCount());
      assertFalse("Locked after the document was disposed", webdavServer.isLocked());
    } finally {
      if (!disposed) {
        model.dispose();
      }
    }
  }

  /**
   * Sends the keep-alive requests the browser sends while the document is open. This is what the
   * <code>RESTDocumentManager.keepAlive</code> endpoint does with each of them.
   *
   * @param model The model of the document kept alive.
   *
   * @throws LockException If the lock cannot be updated.
   */
  private static void sendKeepAliveRequests(AuthorDocumentModel model) throws LockException {
    for (int i = 0; i < KEEP_ALIVE_REQUESTS; i++) {
      model.getLockManager().updateLock();
    }
  }

  /**
   * Sets the "Lock resources on open" option of this connector, the way its configuration page
   * sets it.
   *
   * @param enabled Whether resources are locked on open.
   */
  private static void setLockingEnabled(boolean enabled) {
    WSOptionsStorage optionsStorage =
        PluginWorkspaceProvider.getPluginWorkspace().getOptionsStorage();
    optionsStorage.setOption(
        WebdavPluginConfigExtension.LOCKING_ENABLED, enabled ? "on" : "off");
  }

  /**
   * Opens the document from the WebDAV server the way Web Author opens it, locking it on open.
   *
   * @return The model of the document.
   *
   * @throws Exception If it fails.
   */
  private AuthorDocumentModel openDocument() throws Exception {
    return WebappAuthorDocumentFactory.createAuthorDocumentInfo(
        docUrl,
        new StringReader(DOC_CONTENT),
        Collections.emptyList(),
        Collections.<String, Object>emptyMap());
  }

  /**
   * Lays out a plugins folder holding this plugin, so that the application loads it from the
   * classes this build produced.
   *
   * @return The folder to be used as plugins folder.
   *
   * @throws IOException If the descriptor cannot be written.
   */
  private static File createPluginsDir() throws IOException {
    File pluginsDir = new File("target/test-plugins");
    File pluginDir = new File(pluginsDir, "webdav-connector");
    pluginDir.mkdirs();

    String descriptor =
        new String(Files.readAllBytes(new File("plugin.xml").toPath()), StandardCharsets.UTF_8);
    // The DTD sits next to the plugins folder of an Oxygen installation, which we do not have.
    descriptor = descriptor.replaceAll("(?s)<!DOCTYPE.*?>", "");
    // The version is filtered in when the plugin is assembled.
    descriptor = descriptor.replace("${project.nosnapshot.version}", "1.0.0");
    // The classes are two levels up, where this build left them.
    descriptor = descriptor.replace(
        "<library name=\"target/classes\"/>", "<library name=\"../../classes\"/>");
    Files.write(new File(pluginDir, "plugin.xml").toPath(),
        descriptor.getBytes(StandardCharsets.UTF_8));

    return pluginsDir;
  }

  /**
   * An in-memory session store, standing in for the one the Web Author servlet layer installs. The
   * connector keeps the credentials of each user in it; these tests store none, the WebDAV server
   * they talk to needing no authentication.
   *
   * @author bogdan_dumitru
   */
  private static final class MemorySessionStoreForTests implements SessionStore {

    /**
     * The data of each session, by session ID.
     */
    private final Map<String, Map<String, Object>> sessions = new HashMap<String, Map<String, Object>>();

    /**
     * @param sessionId The ID of the session.
     *
     * @return The data of the given session, created if this is the first access to it.
     */
    private Map<String, Object> session(String sessionId) {
      return sessions.computeIfAbsent(sessionId, id -> new HashMap<String, Object>());
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T> T get(String sessionId, String key) {
      return (T) session(sessionId).get(key);
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T> T getAndDel(String sessionId, String key) {
      return (T) session(sessionId).remove(key);
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T> T computeIfAbsent(String sessionId, String key, Supplier<T> valueSupplier) {
      return (T) session(sessionId).computeIfAbsent(key, k -> valueSupplier.get());
    }

    @Override
    public <T> T computeIfAbsentWithoutSessionCookieRefresh(String sessionId, String key,
        Supplier<T> valueSupplier) {
      return computeIfAbsent(sessionId, key, valueSupplier);
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T> T putIfAbsent(String sessionId, String key, T value) {
      return (T) session(sessionId).putIfAbsent(key, value);
    }

    @Override
    public <T> T putIfAbsentWithoutSessionCookieRefresh(String sessionId, String key, T value) {
      return putIfAbsent(sessionId, key, value);
    }

    @Override
    public <T> void put(String sessionId, String key, T value) {
      session(sessionId).put(key, value);
    }

    @Override
    public <T> void putWithoutSessionCookieRefresh(String sessionId, String key, T value) {
      put(sessionId, key, value);
    }

    @Override
    public void remove(String sessionId, String key) {
      session(sessionId).remove(key);
    }

    @Override
    public void invalidate(String sessionId) {
      sessions.remove(sessionId);
    }

    @Override
    public void refreshSessionCookie(String sessionId) {
      // There are no cookies outside a servlet container.
    }

    @Override
    public void invalidateAll() {
      sessions.clear();
    }
  }

  /**
   * A WebDAV server that locks and unlocks a single resource and records the lock-related requests
   * it receives.
   *
   * @author bogdan_dumitru
   */
  private static class WebdavServerForTests implements HttpHandler {

    /**
     * The token of the lock currently held on the resource, <code>null</code> if the resource is
     * not locked.
     */
    private String lockToken;

    /**
     * The timeouts, in seconds, requested by each of the LOCK requests received so far.
     */
    private final List<Integer> lockTimeouts = new ArrayList<Integer>();

    /**
     * How many UNLOCK requests were received so far.
     */
    private int unlockRequestCount;

    /**
     * @see com.sun.net.httpserver.HttpHandler#handle(com.sun.net.httpserver.HttpExchange)
     */
    @Override
    public synchronized void handle(HttpExchange exchange) throws IOException {
      InputStream requestBody = exchange.getRequestBody();
      try {
        // The body has to be read before the response is sent.
        while (requestBody.read() != -1) {
          // Just drain it.
        }
      } finally {
        requestBody.close();
      }

      String method = exchange.getRequestMethod();
      if ("PROPFIND".equals(method)) {
        respondToPropFind(exchange);
      } else if ("LOCK".equals(method)) {
        respondToLock(exchange);
      } else if ("UNLOCK".equals(method)) {
        unlockRequestCount++;
        lockToken = null;
        exchange.sendResponseHeaders(204, -1);
        exchange.close();
      } else if ("GET".equals(method)) {
        respond(exchange, 200, DOC_CONTENT);
      } else {
        exchange.sendResponseHeaders(200, -1);
        exchange.close();
      }
    }

    /**
     * Answers a PROPFIND with the lock capabilities of this server and with the lock currently
     * held on the resource. The lock handler asks for them before its first LOCK, to find out
     * whether the server supports exclusive write locks at all.
     *
     * @param exchange The PROPFIND exchange.
     *
     * @throws IOException If the response cannot be sent.
     */
    private void respondToPropFind(HttpExchange exchange) throws IOException {
      respond(exchange, 207,
          "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
          + "<D:multistatus xmlns:D=\"DAV:\">"
          + "<D:response>"
          + "<D:href>" + exchange.getRequestURI().getPath() + "</D:href>"
          + "<D:propstat>"
          + "<D:prop>"
          + "<D:supportedlock>"
          + "<D:lockentry>"
          + "<D:lockscope><D:exclusive/></D:lockscope>"
          + "<D:locktype><D:write/></D:locktype>"
          + "</D:lockentry>"
          + "</D:supportedlock>"
          + "<D:lockdiscovery>" + activeLockElement() + "</D:lockdiscovery>"
          + "</D:prop>"
          + "<D:status>HTTP/1.1 200 OK</D:status>"
          + "</D:propstat>"
          + "</D:response>"
          + "</D:multistatus>");
    }

    /**
     * Locks the resource, or refreshes the lock when the request carries the token of the lock
     * already held on it. A request for a resource locked by somebody else is answered 423.
     *
     * @param exchange The LOCK exchange.
     *
     * @throws IOException If the response cannot be sent.
     */
    private void respondToLock(HttpExchange exchange) throws IOException {
      lockTimeouts.add(Integer.valueOf(requestedTimeoutSeconds(exchange)));

      String ifHeader = exchange.getRequestHeaders().getFirst("If");
      boolean isRefresh = ifHeader != null && lockToken != null && ifHeader.contains(lockToken);
      if (lockToken != null && !isRefresh) {
        exchange.sendResponseHeaders(423, -1);
        exchange.close();
        return;
      }
      if (lockToken == null) {
        lockToken = "opaquelocktoken:" + UUID.randomUUID();
      }
      respond(exchange, 200,
          "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
          + "<D:prop xmlns:D=\"DAV:\">"
          + "<D:lockdiscovery>" + activeLockElement() + "</D:lockdiscovery>"
          + "</D:prop>");
    }

    /**
     * @return The DAV:activelock element describing the lock held on the resource, empty if the
     * resource is not locked.
     */
    private String activeLockElement() {
      if (lockToken == null) {
        return "";
      }
      return "<D:activelock>"
          + "<D:locktype><D:write/></D:locktype>"
          + "<D:lockscope><D:exclusive/></D:lockscope>"
          + "<D:depth>0</D:depth>"
          // DAV:owner is not optional for the client: LockDiscoveryProperty reads its text
          // without checking that the element is there.
          + "<D:owner>" + MockAuthorDocumentFactory.USER + "</D:owner>"
          + "<D:timeout>Second-" + getLastLockTimeoutSeconds() + "</D:timeout>"
          + "<D:locktoken><D:href>" + lockToken + "</D:href></D:locktoken>"
          + "</D:activelock>";
    }

    /**
     * @param exchange A LOCK exchange.
     *
     * @return The number of seconds the lock was requested for, <code>-1</code> if the request
     * carries no Timeout header.
     */
    private static int requestedTimeoutSeconds(HttpExchange exchange) {
      String value = exchange.getRequestHeaders().getFirst("Timeout");
      if (value == null) {
        return -1;
      }
      int secondIdx = value.indexOf("Second-");
      if (secondIdx == -1) {
        return -1;
      }
      String seconds = value.substring(secondIdx + "Second-".length()).trim();
      int separatorIdx = seconds.indexOf(',');
      if (separatorIdx != -1) {
        seconds = seconds.substring(0, separatorIdx);
      }
      return Integer.parseInt(seconds);
    }

    /**
     * Sends an XML response.
     *
     * @param exchange The exchange to answer.
     * @param status   The status code of the response.
     * @param xml      The body of the response.
     *
     * @throws IOException If the response cannot be sent.
     */
    private static void respond(HttpExchange exchange, int status, String xml) throws IOException {
      byte[] body = xml.getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().add("Content-Type", "text/xml; charset=utf-8");
      exchange.sendResponseHeaders(status, body.length);
      exchange.getResponseBody().write(body);
      exchange.close();
    }

    /**
     * @return <code>true</code> if the resource is currently locked.
     */
    public synchronized boolean isLocked() {
      return lockToken != null;
    }

    /**
     * @return How many LOCK requests were received so far.
     */
    public synchronized int getLockRequestCount() {
      return lockTimeouts.size();
    }

    /**
     * @return How many UNLOCK requests were received so far.
     */
    public synchronized int getUnlockRequestCount() {
      return unlockRequestCount;
    }

    /**
     * @return The number of seconds requested by the last LOCK request, <code>-1</code> if no LOCK
     * request was received.
     */
    public synchronized int getLastLockTimeoutSeconds() {
      return lockTimeouts.isEmpty()
          ? -1 : lockTimeouts.get(lockTimeouts.size() - 1).intValue();
    }
  }
}
