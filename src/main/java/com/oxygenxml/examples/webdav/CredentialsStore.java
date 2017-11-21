package com.oxygenxml.examples.webdav;

import java.io.Serializable;
import java.net.PasswordAuthentication;

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
  public static void put(String sessionId, String serverId, String userName, String password) {
    String encryptedPass = PluginWorkspaceProvider.getPluginWorkspace().getUtilAccess().encrypt(password);
    getSessionStore().put(sessionId, getCredentialsKey(serverId), new UsrPass(userName, encryptedPass));
  }

  /**
   * Stores the given credentials if they are not already present.
   * @param sessionId The session id.
   * @param serverId The server id.
   * @param userName The user name.
   * @param password The password.
   */
  public static void putIfAbsent(String sessionId, String serverId, String userName, String password) {
    String encryptedPass = PluginWorkspaceProvider.getPluginWorkspace().getUtilAccess().encrypt(password);
    getSessionStore().putIfAbsent(sessionId, getCredentialsKey(serverId), new UsrPass(userName, encryptedPass));
  }
  
  /**
   * Retrieves the password authentication for the given session and server ids.
   * @param sessionId The session id.
   * @param serverId The server id.
   * @return The password authentication if present or <code>null</code>
   */
  public static PasswordAuthentication get(String sessionId, String serverId) {
    UsrPass usrPass = getSessionStore().get(sessionId, getCredentialsKey(serverId));
    
    if (usrPass != null) {
      String decryptedPass = PluginWorkspaceProvider.getPluginWorkspace().getUtilAccess().decrypt(usrPass.encryptedPassword);
      return new PasswordAuthentication(usrPass.username, decryptedPass.toCharArray());
    }
    
    return null;
  }
  
  /**
   * Invalidates a session's credentials.
   * @param sessionId The session id.
   */
  public static void invalidate(String sessionId) {
    getSessionStore().invalidate(sessionId);
  }

  /**
   * Returns the key used to store credentials for a server id.
   * @param serverId The id of the server for which to store credentials.
   * @return The key used to store credentials.
   */
  public static String getCredentialsKey(String serverId) {
    return "webdav.creds." + serverId;
  }
  
  /**
   * @return The session store.
   */
  private static SessionStore getSessionStore() {
    WebappPluginWorkspace workspace = (WebappPluginWorkspace) PluginWorkspaceProvider.getPluginWorkspace();
    return workspace.getSessionStore();
  }
}
