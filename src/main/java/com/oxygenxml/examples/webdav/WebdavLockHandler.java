package com.oxygenxml.examples.webdav;

import java.net.PasswordAuthentication;
import java.net.URL;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import ro.sync.ecss.extensions.api.webapp.access.WebappPluginWorkspace;
import ro.sync.ecss.extensions.api.webapp.plugin.LockHandlerWithContext;
import ro.sync.exml.plugin.lock.LockException;
import ro.sync.exml.workspace.api.PluginResourceBundle;
import ro.sync.exml.workspace.api.PluginWorkspaceProvider;
import ro.sync.exml.workspace.api.options.WSOptionsStorage;
import ro.sync.net.protocol.http.WebdavLockHelper;
import ro.sync.servlet.WebappTags;

/**
 * Lock handler for the WebDAV protocol.
 * 
 * @author cristi_talau, mihai_coanda
 */
public class WebdavLockHandler extends LockHandlerWithContext {
  private WebdavLockHelper webdavLockHelper; 
  
  public WebdavLockHandler() {
    webdavLockHelper = new WebdavLockHelper(); 
  }

  /**
   * @see LockHandlerWithContext#isSaveAllowed(String, URL, int)
   */
  @Override
  public boolean isSaveAllowed(String sessionId, URL url, int timeoutSeconds) {
    url = WebdavUrlStreamHandler.addCredentials(sessionId, url);
    
    return webdavLockHelper.isSaveAllowed(sessionId, url, timeoutSeconds);
  }

  /**
   * @see LockHandlerWithContext#unlock(String, URL)
   */
  @Override
  public void unlock(String sessionId, URL url) throws LockException {
    url = WebdavUrlStreamHandler.addCredentials(sessionId, url);
    // headers passed to the server. 
    List<String> headerKeys = Collections.emptyList();
    List<String> headerValues = Collections.emptyList();;
    
    webdavLockHelper.unlock(sessionId, url, headerKeys, headerValues);
  }

  /**
   * @see LockHandlerWithContext#updateLock(String, URL, int)
   */
  @Override
  public void updateLock(String sessionId, URL url, int timeoutSeconds) throws LockException {
    url = WebdavUrlStreamHandler.addCredentials(sessionId, url);
    
    Map<String, PasswordAuthentication> credentialsMap = WebdavUrlStreamHandler.credentials.getIfPresent(sessionId);
    String serverId = WebdavUrlStreamHandler.computeServerId("webdav-" + url.toExternalForm());
    
    PasswordAuthentication passwordAuthentication = null;
    
    if(credentialsMap != null) {
      passwordAuthentication = credentialsMap.get(serverId);
    }
    PluginResourceBundle rb = ((WebappPluginWorkspace)PluginWorkspaceProvider.getPluginWorkspace()).getResourceBundle();
    String userName = passwordAuthentication != null ? passwordAuthentication.getUserName() : rb.getMessage(WebappTags.ANONYMOUS);
    
    // headers passed to the server. 
    List<String> headerKeys = Collections.emptyList();
    List<String> headerValues = Collections.emptyList();;
    webdavLockHelper.setLockOwner(sessionId, userName);
    
    webdavLockHelper.updateLock(sessionId, url, timeoutSeconds, headerKeys, headerValues);
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
