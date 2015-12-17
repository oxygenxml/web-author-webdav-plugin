package com.oxygenxml.examples.webdav;

import java.net.PasswordAuthentication;
import java.net.URL;

import ro.sync.ecss.extensions.api.webapp.plugin.LockHandlerWithContext;
import ro.sync.exml.plugin.lock.LockException;
import ro.sync.exml.workspace.api.PluginWorkspaceProvider;
import ro.sync.exml.workspace.api.options.WSOptionsStorage;
import ro.sync.net.protocol.http.WebdavLockHelper;

/**
 * Lock handler for the WebDAV protocol.
 * 
 * @author cristi_talau
 */
public class WebdavLockHandler extends LockHandlerWithContext {

  /**
   * @see LockHandlerWithContext#isSaveAllowed(String, URL, int)
   */
  @Override
  public boolean isSaveAllowed(String sessionId, URL url, int timeoutSeconds) {
    url = WebdavUrlStreamHandler.addCredentials(sessionId, url);
    return new WebdavLockHelper().isSaveAllowed(sessionId, url, timeoutSeconds);
  }

  /**
   * @see LockHandlerWithContext#unlock(String, URL)
   */
  @Override
  public void unlock(String sessionId, URL url) throws LockException {
    url = WebdavUrlStreamHandler.addCredentials(sessionId, url);
    new WebdavLockHelper().unlock(sessionId, url);
  }

  /**
   * @see LockHandlerWithContext#updateLock(String, URL, int)
   */
  @Override
  public void updateLock(String sessionId, URL url, int timeoutSeconds) throws LockException {
    url = WebdavUrlStreamHandler.addCredentials(sessionId, url);
    WebdavLockHelper lockHelper = new WebdavLockHelper();

    PasswordAuthentication passwordAuthentication = WebdavUrlStreamHandler.credentials.get(sessionId);
    if (passwordAuthentication != null) {
      lockHelper.setLockOwner(sessionId, passwordAuthentication.getUserName());
    }

    lockHelper.updateLock(sessionId, url, timeoutSeconds);
  }

  /**
   * @see LockHandlerWithContext#isLockEnabled()
   */
  @Override
  public boolean isLockEnabled() {
    WSOptionsStorage optionsStorage = PluginWorkspaceProvider.getPluginWorkspace().getOptionsStorage();
    String optionValue = optionsStorage.getOption(WebdavPluginConfigExtension.LOCKING_ENABLED, "on");
    return "on".equals(optionValue);
  }
}
