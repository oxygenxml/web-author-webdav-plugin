package com.oxygenxml.examples.webdav;

import ro.sync.exml.plugin.Plugin;
import ro.sync.exml.plugin.PluginDescriptor;

/**
 * Plugin that enables the webdav protocol.
 */
public class WebdavPlugin extends Plugin {
  /**
   * Constructor.
   * 
   * @param descriptor The plugin descriptor.
   */
  public WebdavPlugin(PluginDescriptor descriptor) {
    super(descriptor);
  }
}
