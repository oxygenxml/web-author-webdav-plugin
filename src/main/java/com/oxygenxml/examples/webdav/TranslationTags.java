package com.oxygenxml.examples.webdav;

public interface TranslationTags {
  
  /**
   * Label for input. Used in WebDAV plugin configuration.
   * 
   * en: Lock resources on open
   */
  String LOCK_RESOURCES_ON_OPEN = "Lock_resources_on_open";
  /**
   * Label for input. Used in WebDAV plugin configuration.
   * 
   * en: Autosave interval
   */
  String AUTOSAVE_INTERVAL = "Autosave_interval";
  /**
   * Complements the 'Autosave interval' input. Used in WebDAV plugin configuration.
   * 
   * en: seconds
   */
  String SECONDS = "Seconds";
  
  /**
   * Placeholder for input. Used in WebDAV plugin configuration.
   * 
   * en: Server URL
   */
  String SERVER_URL = "Server_URL";
  
  /**
   * Label for input. Used in WebDAV plugin configuration.
   * 
   * en: Enforced server
   */
  String ENFORCED_SERVER = "Enforced_server";
  /**
   * Warning for the 'Enforce server' setting. Used in WebDAV plugin configuration.
   * 
   * en: Note: Once a server is enforced, the user will only be able to browse this enforced server. 
   * However, it is possible for other plugins to add more enforced servers for the user to choose from.
   */
  String ENFORCED_SERVER_NOTE = "Enforced_server_note";
  
  /**
   * Title of login dialog.
   * 
   * en: Authentication required
   */
  String AUTHENTICATION_REQUIRED = "Authentication_required";
  
  /**
   * Default author name for comments.
   * 
   * en: Anonymous
   */
  String ANONYMOUS = "Anonymous";
}
