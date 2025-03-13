package com.oxygenxml.examples.webdav;

import java.io.Serializable;
import java.net.PasswordAuthentication;
import java.util.HashMap;
import java.util.Map;

import ro.sync.ecss.extensions.api.webapp.SessionStore;
import ro.sync.ecss.extensions.api.webapp.access.WebappPluginWorkspace;
import ro.sync.exml.workspace.api.PluginWorkspaceProvider;

/**
 * Store for WebDav credentials.
 * @author gabriel_titerlea
 *
 */
public class CredentialsStore {
  /**
   * Structure to hold a user name and encrypted password.
   * @author gabriel_titerlea
   *
   */
  private static final class UsrPass implements Serializable {
    /**
     * Version for serialization.
     */
    private static final long serialVersionUID = 1L;

    /**
     * The user name to store.
     */
    String username;
    
    /**
     * THe encrypted password to store.
     */
    String encryptedPassword;
    
    /**
     * Creates a UsrPass instance.
     * @param userName The user name to store.
     * @param encryptedPassword THe encrypted password to store.
     */
    UsrPass(String userName, String encryptedPassword) {
      this.username = userName;
      this.encryptedPassword = encryptedPassword;
    }
  }
  
  /**
   * Stores the given credentials.
   * @param sessionId The session id.
   * @param serverId The server id.
   * @param userName The user name.
   * @param password The password.
   */
  public synchronized static void put(String sessionId, String serverId, String userName, String password) {
    String encryptedPass = PluginWorkspaceProvider.getPluginWorkspace().getUtilAccess().encrypt(password);
    
    Map<String, UsrPass> webdavServersCredentiasls = getSessionStore().get(sessionId, getCredentialsKey());
    if (webdavServersCredentiasls == null) {
      webdavServersCredentiasls = new HashMap<>();
      getSessionStore().put(sessionId, getCredentialsKey(), webdavServersCredentiasls);
    }
    
    webdavServersCredentiasls.put(serverId, new UsrPass(userName, encryptedPass));
  }

  /**
   * Stores the given credentials if they are not already present.
   * @param sessionId The session id.
   * @param serverId The server id.
   * @param userName The user name.
   * @param password The password.
   */
  public synchronized static void putIfAbsentWithoutSessionCookieRefresh(String sessionId, String serverId, String userName, String password) {
    String encryptedPass = PluginWorkspaceProvider.getPluginWorkspace().getUtilAccess().encrypt(password);
    
    Map<String, UsrPass> webdavServersCredentiasls = getSessionStore().get(sessionId, getCredentialsKey());
    if (webdavServersCredentiasls == null) {
      webdavServersCredentiasls = new HashMap<>();
      webdavServersCredentiasls.put(serverId, new UsrPass(userName, encryptedPass));
      getSessionStore().putWithoutSessionCookieRefresh(sessionId, getCredentialsKey(), webdavServersCredentiasls);
    } else {
      webdavServersCredentiasls.putIfAbsent(serverId, new UsrPass(userName, encryptedPass));
    }
  }

  /**
   * Retrieves the password authentication for the given session and server ids.
   * @param sessionId The session id.
   * @param serverId The server id.
   * @return The password authentication if present or <code>null</code>
   */
  public synchronized static PasswordAuthentication get(String sessionId, String serverId) {
    Map<String, UsrPass> webdavServersCredentiasls = getSessionStore().get(sessionId, getCredentialsKey());
    
    if (webdavServersCredentiasls != null) {
      UsrPass usrPass = webdavServersCredentiasls.get(serverId);
      
      if (usrPass != null) {
        String decryptedPass = PluginWorkspaceProvider.getPluginWorkspace().getUtilAccess().decrypt(usrPass.encryptedPassword);
        return new PasswordAuthentication(usrPass.username, decryptedPass.toCharArray());
      }
    }
    
    return null;
  }
  
  /**
   * Invalidates a session's credentials.
   * @param sessionId The session id.
   */
  public synchronized static void invalidate(String sessionId) {
    getSessionStore().remove(sessionId, getCredentialsKey());
  }

  /**
   * Returns the key used to store credentials for a server id.
   * @param serverId The id of the server for which to store credentials.
   * @return The key used to store credentials.
   */
  private static String getCredentialsKey() {
    return "webdav.creds";
  }
  
  /**
   * @return The session store.
   */
  private static SessionStore getSessionStore() {
    WebappPluginWorkspace workspace = (WebappPluginWorkspace) PluginWorkspaceProvider.getPluginWorkspace();
    return workspace.getSessionStore();
  }
}
