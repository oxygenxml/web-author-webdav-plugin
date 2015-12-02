package com.oxygenxml.examples.webdav;

import ro.sync.exml.plugin.lock.LockHandler;
import ro.sync.exml.plugin.urlstreamhandler.LockHandlerFactoryPluginExtension;
import ro.sync.exml.workspace.api.Platform;
import ro.sync.exml.workspace.api.PluginWorkspaceProvider;

/**
 * Plugin extension responsible for handling lock/unlock requests.
 * 
 * @author cristi_talau
 */
public class WebdavLockHandlerFactory implements LockHandlerFactoryPluginExtension {
  
  /**
   * @return The lock handler.
   */
  public LockHandler getLockHandler() {
    return new WebdavLockHandler();
  }

  /**
   * @return <code>true</code> for the WebDAV protocol.
   */
  public boolean isLockingSupported(String protocol) {
    boolean isWebapp = Platform.WEBAPP.equals(PluginWorkspaceProvider.getPluginWorkspace().getPlatform());
    return isWebapp && protocol.startsWith(WebdavURLHandlerExtension.WEBDAV);
  }

}
