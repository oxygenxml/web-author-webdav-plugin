package com.oxygenxml.examples.webdav;

import javax.servlet.ServletException;

import com.google.common.collect.ImmutableMap;

import ro.sync.ecss.extensions.api.webapp.plugin.PluginConfigExtension;

/**
 * Plugin extension used to handle the configuration of this plugin.
 */
public class WebdavPluginConfigExtension extends PluginConfigExtension {

  /**
   * Flag indicating whether documents should be locked on open.
   */
  private final String LOCKING_ENABLED = "lock_on_open";
  
  @Override
  public void init() throws ServletException {
    super.init();
    setDefaultOptions(ImmutableMap.of(LOCKING_ENABLED, "true"));
  }
  
  @Override
  public String getPath() {
    return "webdav-config";
  }
  
  /**
   * @see ro.sync.ecss.extensions.api.webapp.plugin.PluginConfigExtension#getOptionsForm()
   */
  @Override
  public String getOptionsForm() {
    return "<div style='font-family:robotolight, Arial, Helvetica, sans-serif;font-size:0.85em;font-weight: lighter'>"
            + "<form style='text-align:left;line-height: 1.7em;'>"
              + "<label style='margin-bottom:6px;display:block;overflow:hidden'>"
                + "<input name=\"lock_on_open\" type=\"checkbox\"> Lock resources on open"
              + "</label>"
            + "</form>"
          + "</div>";
  }
  
  /**
   * @see ro.sync.ecss.extensions.api.webapp.plugin.PluginConfigExtension#getOptionsJson().
   */
  @Override
  public String getOptionsJson() {
    return "{\"lock_on_open\":\"" 
        + getOption(LOCKING_ENABLED, "true")
        + "\"}";
  }
}
