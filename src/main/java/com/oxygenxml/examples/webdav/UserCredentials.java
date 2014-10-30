package com.oxygenxml.examples.webdav;

import java.net.PasswordAuthentication;
import java.util.HashMap;
import java.util.Map;

import com.google.common.base.Objects;

/**
 * A set of credentials for an user on multiple realms.
 * 
 * @author cristi_talau
 */
public class UserCredentials {
  /**
   * Class that identifies a server on which authentication is required.
   * 
   * @author cristi_talau
   */
  public static class Realm {
    /**
     * The hostname.
     */
    private String host;
    /**
     * The port.
     */
    private int port;
    
    /**
     * Constructor. 
     * 
     * @param host The hostname of the server.
     * @param port The port on which the webdav server listens.
     */
    public Realm(String host, int port) {
      this.host = host;
      this.port = port;
    }

    @Override
    public boolean equals(Object obj) {
      if (obj instanceof Realm) {
        Realm otherRealm = (Realm) obj;
        return Objects.equal(host, otherRealm.host) && port == otherRealm.port;
      }
      return false;
    }

    @Override
    public int hashCode() {
      return Objects.hashCode(host, port);
    }
  }

  /**
   * Association map of credentials to realms.
   */
  private final Map<Realm, PasswordAuthentication> credentials;

  /**
   * Constructor.
   */
  public UserCredentials() {
    credentials = new HashMap<Realm, PasswordAuthentication>();
  }

  /**
   * Returns the credentials for a given realm.
   * 
   * @param realm The realm.
   * 
   * @return The credentials.
   */
  public PasswordAuthentication getCredentials(Realm realm) {
    return credentials.get(realm);
  }

  /**
   * Records the credentials for a given realm.
   * 
   * @param realm The realm.
   * @param passwd The credentials.   
   */
  public void setCredentials(Realm realm, PasswordAuthentication passwd) {
    credentials.put(realm, passwd);
  }

  /**
   * Reset the credentials for a given realm.
   * 
   * @param realm The realm.
   */
  public void resetCredentials(Realm realm) {
    credentials.remove(realm);
  }
}
