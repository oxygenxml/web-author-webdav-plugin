package com.oxygenxml.examples.webdav;

import java.net.PasswordAuthentication;
import java.net.URL;

import org.apache.log4j.Logger;

import ro.sync.ecss.extensions.api.webapp.plugin.LockHandlerWithContext;
import ro.sync.ecss.extensions.api.webapp.plugin.UserActionRequiredException;
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
   * Logger for logging.
   */
  private static final Logger logger = Logger.getLogger(WebdavLockHandler.class.getName());

  /**
   * @see LockHandlerWithContext#isSaveAllowed(String, URL, int)
   */
  @Override
  public boolean isSaveAllowed(String sessionId, URL url, int timeoutSeconds) {
    try {
      url = WebdavUrlStreamHandler.addCredentials(sessionId, url);
    } catch (UserActionRequiredException e) {
      // The user should be already authenticated. Anyway, we cannot do anything 
      // from this method call.
      logger.debug(e, e);
    }
    return new WebdavLockHelper().isSaveAllowed(sessionId, url, timeoutSeconds);
  }

  /**
   * @see LockHandlerWithContext#unlock(String, URL)
   */
  @Override
  public void unlock(String sessionId, URL url) throws LockException {
    try {
      url = WebdavUrlStreamHandler.addCredentials(sessionId, url);
    } catch (UserActionRequiredException e) {
      // The user should be already authenticated. Anyway, we cannot do anything 
      // from this method call.
      logger.debug(e, e);
    }
    new WebdavLockHelper().unlock(sessionId, url);
  }

  /**
   * @see LockHandlerWithContext#updateLock(String, URL, int)
   */
  @Override
  public void updateLock(String sessionId, URL url, int timeoutSeconds) throws LockException {
    try {
      url = WebdavUrlStreamHandler.addCredentials(sessionId, url);
    } catch (UserActionRequiredException e) {
      // The user should be already authenticated. Anyway, we cannot do anything 
      // from this method call.
      logger.debug(e, e);
    }
    WebdavLockHelper lockHelper = new WebdavLockHelper();

    PasswordAuthentication passwordAuthentication = WebdavUrlStreamHandler.credentials.getIfPresent(sessionId);
    String userName = passwordAuthentication != null ? passwordAuthentication.getUserName() : "Anonymous";
    lockHelper.setLockOwner(sessionId, userName);

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
