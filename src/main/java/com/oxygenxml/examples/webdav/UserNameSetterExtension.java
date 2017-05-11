package com.oxygenxml.examples.webdav;

import java.net.PasswordAuthentication;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import ro.sync.ecss.extensions.api.webapp.access.EditingSessionOpenVetoException;
import ro.sync.ecss.extensions.api.webapp.access.WebappEditingSessionLifecycleListener;
import ro.sync.ecss.extensions.api.webapp.access.WebappPluginWorkspace;
import ro.sync.exml.plugin.workspace.WorkspaceAccessPluginExtension;
import ro.sync.exml.workspace.api.standalone.StandalonePluginWorkspace;


/**
 * Extension that sets the username when communicating with the WebDAV server even if 
 * authentication is not required. 
 * 
 * It is helpful to identify who owns a lock. 
 * 
 * @author cristi_talau
 */
public class UserNameSetterExtension implements WorkspaceAccessPluginExtension {
  /**
   * The option name for the session ID.
   */
  private static final String SESSION_ID = "session-id";
  
  /**
   * The option name for the name of the current user.
   */
  private static final String USER_NAME = "userName";

  /**
   * Callback when the application started.
   * 
   * @param pluginWorkspaceAccess The plugin workspace access.
   */
  public void applicationStarted(StandalonePluginWorkspace pluginWorkspaceAccess) {
    WebappPluginWorkspace ws = (WebappPluginWorkspace) pluginWorkspaceAccess;
    ws.addEditingSessionLifecycleListener(new WebappEditingSessionLifecycleListener() {
      
      @Override
      public void editingSessionAboutToBeStarted(String docId, String licenseeId, URL systemId,
          Map<String, Object> options) throws EditingSessionOpenVetoException {
        String userName = (String) options.get(USER_NAME);
        if (userName == null) {
          return;
        }
        String sessionId = (String) options.get(SESSION_ID);
        if (sessionId == null) {
          return;
        }
        
        ConcurrentHashMap<String, PasswordAuthentication> userCredentialsMap = WebdavUrlStreamHandler.credentials.getIfPresent(sessionId);
        if(userCredentialsMap == null) {
          userCredentialsMap = new ConcurrentHashMap<String, PasswordAuthentication>(1, 0.5f, 1);
          WebdavUrlStreamHandler.credentials.put(sessionId, userCredentialsMap);
        } 
        String serverId = WebdavUrlStreamHandler.computeServerId(systemId.toExternalForm());
        // If the user is not already logged-in, login them with an empty password so that the 
        // server knows the name of the user that requests the lock.
        userCredentialsMap.putIfAbsent(serverId, new PasswordAuthentication(userName, new char[0]));
      }
    });
    
  }

  /**
   * Callback when the application closes.
   */
  public boolean applicationClosing() {
    return true;
  }
}
