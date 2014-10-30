package com.oxygenxml.examples.webdav;

import java.net.URLStreamHandler;

import ro.sync.exml.plugin.urlstreamhandler.URLStreamHandlerPluginExtension;


/**
 * Plugin extension.
 */
public class WebdavURLHandlerExtension implements URLStreamHandlerPluginExtension {
  /**
   * Prefix of the protocol. 
   * 
   * We translate http to webdav-http and https to webdav-https.
   */
  public static final String WEBDAV = "webdav-";
  
  /**
   * @see ro.sync.exml.plugin.urlstreamhandler.URLStreamHandlerPluginExtension#getURLStreamHandler(java.lang.String)
   */
  @Override
  public URLStreamHandler getURLStreamHandler(String protocol) {
    if (protocol.startsWith(WEBDAV)) {
      return new WebdavUrlStreamHandler();
    }
    return null;
  }
}
