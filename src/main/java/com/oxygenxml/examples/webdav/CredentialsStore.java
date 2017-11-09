package com.oxygenxml.examples.webdav;

import java.net.PasswordAuthentication;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;

import org.apache.log4j.Logger;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;

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
  private static final class UsrPass {
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
   * Logger for logging.
   */
  private static final Logger logger = Logger.getLogger(
      CredentialsStore.class.getName());
  
  /**
   * Credentials store.
   * <sessionId, <url, credentials>>
   */
  private static final Cache<String, ConcurrentHashMap<String, UsrPass>> credentials = 
      CacheBuilder.newBuilder()
        .concurrencyLevel(10)
        .maximumSize(10000)
        .build();

  /**
   * Value loader used to make sure a Map is present in credentials for a given session.
   */
  private static final Callable<ConcurrentHashMap<String, UsrPass>> valueLoader = new Callable<ConcurrentHashMap<String, UsrPass>>() {
    public ConcurrentHashMap<String, UsrPass> call() throws Exception {
      return new ConcurrentHashMap<String, UsrPass>(1, 0.5f, 1);
    }
  };
  
  /**
   * Stores the given credentials.
   * @param sessionId The session id.
   * @param serverId The server id.
   * @param userName The user name.
   * @param password The password.
   */
  public static void put(String sessionId, String serverId, String userName, String password) {
    try {
      ConcurrentHashMap<String, UsrPass> sessionCredentials = credentials.get(sessionId, valueLoader);
      
      String encryptedPass = PluginWorkspaceProvider.getPluginWorkspace().getUtilAccess().encrypt(password);
      sessionCredentials.put(serverId, new UsrPass(userName, encryptedPass));
    } catch (ExecutionException e) {
      logger.error("Error while storing webdav credentials", e);
    }
  }

  /**
   * Stores the given credentials if they are not already present.
   * @param sessionId The session id.
   * @param serverId The server id.
   * @param userName The user name.
   * @param password The password.
   */
  public static void putIfAbsent(String sessionId, String serverId, String userName, String password) {
    try {
      ConcurrentHashMap<String, UsrPass> sessionCredentials = credentials.get(sessionId, valueLoader);
      
      String encryptedPass = PluginWorkspaceProvider.getPluginWorkspace().getUtilAccess().encrypt(password);
      sessionCredentials.putIfAbsent(serverId, new UsrPass(userName, encryptedPass));
    } catch (ExecutionException e) {
      logger.error("Error while storing webdav credentials (ifPresent)", e);
    }
  }
  
  /**
   * Retrieves the password authentication for the given session and server ids.
   * @param sessionId The session id.
   * @param serverId The server id.
   * @return The password authentication if present or <code>null</code>
   */
  public static PasswordAuthentication get(String sessionId, String serverId) {
    try {
      ConcurrentHashMap<String, UsrPass> sessionCredentials = credentials.get(sessionId, valueLoader);
      UsrPass usrPass = sessionCredentials.get(serverId);
      
      if (usrPass != null) {
        String decryptedPass = PluginWorkspaceProvider.getPluginWorkspace().getUtilAccess().decrypt(usrPass.encryptedPassword);
        return new PasswordAuthentication(usrPass.username, decryptedPass.toCharArray());
      }
    } catch (ExecutionException e) {
      logger.error("Error while retrieving webdav credentials", e);
    }
    return null;
  }
  
  /**
   * Invalidates a session's credentials.
   * @param sessionId The session id.
   */
  public static void invalidate(String sessionId) {
    credentials.invalidate(sessionId);
  }
}
