package com.oxygenxml.examples.webdav;

import java.net.PasswordAuthentication;
import java.net.URL;
import java.util.Collections;
import java.util.List;

import ro.sync.ecss.extensions.api.webapp.access.WebappPluginWorkspace;
import ro.sync.ecss.extensions.api.webapp.plugin.LockHandlerWithContext;
import ro.sync.exml.plugin.lock.LockException;
import ro.sync.exml.workspace.api.PluginResourceBundle;
import ro.sync.exml.workspace.api.PluginWorkspaceProvider;
import ro.sync.exml.workspace.api.options.WSOptionsStorage;
import ro.sync.net.protocol.http.WebdavLockHelper;

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

  @Override
  public boolean isSaveAllowed(String contextId, URL url, int timeoutSeconds) {
    url = WebdavUrlStreamHandler.addCredentials(contextId, url);
    
    return webdavLockHelper.isSaveAllowed(contextId, url, timeoutSeconds);
  }

  @Override
  public void unlock(String contextId, URL url) throws LockException {
    url = WebdavUrlStreamHandler.addCredentials(contextId, url);
    // headers passed to the server. 
    List<String> headerKeys = Collections.singletonList("X-Requested-With");
    List<String> headerValues = Collections.singletonList("x");
    
    webdavLockHelper.unlock(contextId, url, headerKeys, headerValues);
  }

  @Override
  public void updateLock(String contextId, URL url, int timeoutSeconds) throws LockException {
    url = WebdavUrlStreamHandler.addCredentials(contextId, url);
    
    String serverId = WebdavUrlStreamHandler.computeServerId("webdav-" + url.toExternalForm());
    PasswordAuthentication passwordAuthentication = CredentialsStore.get(contextId, serverId);
    
    PluginResourceBundle rb = ((WebappPluginWorkspace)PluginWorkspaceProvider.getPluginWorkspace()).getResourceBundle();
    String userName = passwordAuthentication != null ? passwordAuthentication.getUserName() : rb.getMessage(TranslationTags.ANONYMOUS);
    
    // headers passed to the server. 
    List<String> headerKeys = Collections.singletonList("X-Requested-With");
    List<String> headerValues = Collections.singletonList("x");
    webdavLockHelper.setLockOwner(contextId, userName);
    
    webdavLockHelper.updateLock(contextId, url, timeoutSeconds, headerKeys, headerValues);
  }

  @Override
  public boolean isLockEnabled() {
    WSOptionsStorage optionsStorage = PluginWorkspaceProvider.getPluginWorkspace().getOptionsStorage();
    String optionValue = optionsStorage.getOption(WebdavPluginConfigExtension.LOCKING_ENABLED, "on");
    return "on".equals(optionValue);
  }
}
