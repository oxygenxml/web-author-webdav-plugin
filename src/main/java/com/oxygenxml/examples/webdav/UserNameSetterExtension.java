package com.oxygenxml.examples.webdav;

import java.net.URL;
import java.util.Map;

import ro.sync.ecss.extensions.api.webapp.access.EditingSessionOpenVetoException;
import ro.sync.ecss.extensions.api.webapp.access.WebappEditingSessionLifecycleListener;
import ro.sync.ecss.extensions.api.webapp.access.WebappPluginWorkspace;
import ro.sync.exml.plugin.workspace.WorkspaceAccessPluginExtension;
import ro.sync.exml.workspace.api.PluginResourceBundle;
import ro.sync.exml.workspace.api.PluginWorkspaceProvider;
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
        if (systemId.getProtocol().startsWith(WebdavURLHandlerExtension.WEBDAV)) {
          String userName = (String) options.get(USER_NAME);
          if (isAnonymousUser(userName)) {
            // The lock will be obtained for an anonymous user anyway.
            return;
          }
          
          String sessionId = (String) options.get(SESSION_ID);
          if (sessionId == null) {
            return;
          }
          
          String serverId = WebdavUrlStreamHandler.computeServerId(systemId.toExternalForm());
          CredentialsStore.putIfAbsent(sessionId, serverId, userName, "");
        }
      }

    });
    
  }

  /**
   * @param userName The name of the user.
   * @return <code>true</code> if the user is anonymous.
   */
  private boolean isAnonymousUser(String userName) {
    PluginResourceBundle rb = ((WebappPluginWorkspace)PluginWorkspaceProvider.getPluginWorkspace()).getResourceBundle();
    return userName == null || rb.getMessage(TranslationTags.ANONYMOUS).equals(userName);
  }
  
  /**
   * Callback when the application closes.
   */
  public boolean applicationClosing() {
    return true;
  }
}
