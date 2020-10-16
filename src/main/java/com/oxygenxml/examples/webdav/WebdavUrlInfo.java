package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.ImmutableMap;
import com.google.common.util.concurrent.Uninterruptibles;

import ro.sync.basic.util.URLUtil;
import ro.sync.ecss.extensions.api.webapp.plugin.WebappServletPluginExtension;

/**
 * Servlet that computes some information about an WebDAV URL that was introduced by the user.
 *  
 * @author cristi_talau
 */
public class WebdavUrlInfo extends WebappServletPluginExtension {

  /**
   * The time allocated for server root computation.
   */
  private static final int SERVER_ROOT_COMPUTATION_ALLOCATION = 3;
  
  /**
   * Logger for logging.
   */
  private static final Logger logger = LogManager.getLogger(WebdavUrlInfo.class.getName());

  /**
   * The resource type
   */
  public static enum ResourceType {
    NON_WEBDAV,
    COLLECTION,
    FILE
  }
  

  /**
   * Return information about the given URL:
   *  - the type of the resource: file vs. collection
   *  - the server root URL
   *  
   * If the user is not authorized to access the given URL, return 401.
   *
   * @see WebappServletPluginExtension#doGet(HttpServletRequest, HttpServletResponse)
   */
  @Override
  public void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
    URL url = new URL(req.getParameter("url"));
    String sessionId = req.getSession().getId();
    
    URL urlWithCredentials = WebdavUrlStreamHandler.addCredentials(sessionId, url);
    ResourceType resourceType = null;
    String errorMessage = null;
    try {
      resourceType = getResourceType(urlWithCredentials);
    } catch (IOException e) {
      if (e.getMessage().indexOf("401") != -1) {
        String userInfo = urlWithCredentials.getUserInfo();
        if(userInfo != null && !userInfo.isEmpty()) {
          String user = URLUtil.extractUser(userInfo);
          String password = URLUtil.extractPassword(userInfo);
          if (user != null && !user.trim().isEmpty() && password != null && !password.trim().isEmpty()) {
            logger.warn("Failed login attempt of user " + user + " for " + URLUtil.getDescription(url));
          }
        }
        // We need credentials.
        resp.sendError(HttpServletResponse.SC_UNAUTHORIZED);
        return;
      } else {
        errorMessage = e.getMessage();
      }
    }
    
    String rootUrl = getRootUrl(urlWithCredentials);
    rootUrl = URLUtil.clearUserInfo(new URL(rootUrl)).toExternalForm();
    
    Map<String, String> info;
    if(errorMessage == null) {
      info = ImmutableMap.of(
          "type", resourceType.toString(),
          "rootUrl", rootUrl);
    } else {
      info = ImmutableMap.of("errorMessage", errorMessage);
    }
    
    new ObjectMapper().writeValue(resp.getOutputStream(), info);
  }

  /**
   * Finds the root of the WebDAV server that serves the given URL.
   * 
   * @param urlWithCredentials The URL to start from.
   *
   * @return The root URL of the server.
   */
  private String getRootUrl(final URL urlWithCredentials) {
    final AtomicReference<String> foundRoot = new AtomicReference<String>(urlWithCredentials.toExternalForm());

    // Make several requests to the webdav server to find the server root.
    // Since this feature is not critical, do not block the user for too long.
    Thread thread = new Thread(new Runnable() {
      
      public void run() {
        String candidateRoot = urlWithCredentials.getProtocol() + "://" + urlWithCredentials.getAuthority();
        String[] pathParts = urlWithCredentials.getPath().split("/");
        
        if (logger.isDebugEnabled()) {
          logger.debug(Arrays.toString(pathParts));
        }
        
        for (String pathPart: pathParts) {
          if (Thread.interrupted()) {
            logger.debug("Time's up searching for server root URL");
            break;
          }
          candidateRoot += pathPart + "/";
          foundRoot.set(candidateRoot);
          ResourceType candidateResourceType = ResourceType.NON_WEBDAV;
          try {
            candidateResourceType = getResourceType(new URL(candidateRoot));
          } catch (IOException e) {
            logger.debug(e, e);
          }
          if (candidateResourceType == ResourceType.COLLECTION) {
            logger.debug("Found server root URL: " + candidateRoot);
            break;
          }
        }
      }
    });
    thread.start();
    Uninterruptibles.joinUninterruptibly(thread, SERVER_ROOT_COMPUTATION_ALLOCATION, TimeUnit.SECONDS);
    if (thread.isAlive()) {
      logger.warn("Did not manage to determine the server root in the allocated time.");
      thread.interrupt();
    }
    return foundRoot.get();
  }

  /**
   * Returns the resource type of the given URL.
   * 
   * @param urlWithCredentials The URL of the resource whose type we want to know. 
   * 
   * @return The resource type.
   *
   * @throws IOException When there is an IOException communicating with server.
   */
  private static ResourceType getResourceType(URL urlWithCredentials) throws IOException {
    ResourceType resourceType = ResourceType.NON_WEBDAV;
    
    // Make a propfind request.
    HttpURLConnection conn = (HttpURLConnection) urlWithCredentials.openConnection();
    conn.setRequestMethod("PROPFIND");
    conn.setRequestProperty("Depth", "0");
    conn.setDoInput(true);
    conn.setDoOutput(true);
    
    String reqBody = "<?xml version=\"1.0\"?>\r\n" + 
        "<a:propfind xmlns:a=\"DAV:\">\r\n" + 
        "<a:prop><a:resourcetype/></a:prop>\r\n" + 
        "</a:propfind>";
   
    OutputStream outputStream = conn.getOutputStream();
    try {
      outputStream.write(reqBody.getBytes());
    } finally {
      outputStream.close();
    }

    // Parse the response.
    DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
    factory.setNamespaceAware(true);
    DocumentBuilder builder;
    try {
      builder = factory.newDocumentBuilder();
    } catch (ParserConfigurationException e) {
      throw new IOException("Error creating parser", e);
    }

    InputStream inputStream = conn.getInputStream();
    Document doc;
    try {
      doc = builder.parse(inputStream);
    } catch (SAXException e) {
      throw new IOException("Error parsing server response", e);
    }
    
    // Look for the response type
    NodeList resourceTypes = doc.getElementsByTagNameNS("DAV:", "resourcetype");
    if (resourceTypes.getLength() == 1) {
      resourceType = ResourceType.FILE;
      Element resourceTypeElement = (Element) resourceTypes.item(0);
      NodeList collections = resourceTypeElement.getElementsByTagNameNS("DAV:", "collection");
      if (collections.getLength() == 1) {
        resourceType = ResourceType.COLLECTION;
      }
    }
    
    return resourceType;
  }
  
  @Override
  public String getPath() {
    return "webdav-url-info";
  }
}
