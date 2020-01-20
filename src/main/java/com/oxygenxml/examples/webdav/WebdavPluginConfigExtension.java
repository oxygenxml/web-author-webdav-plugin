package com.oxygenxml.examples.webdav;

import java.util.HashMap;

import javax.servlet.ServletException;

import ro.sync.ecss.extensions.api.webapp.access.WebappPluginWorkspace;
import ro.sync.ecss.extensions.api.webapp.plugin.PluginConfigExtension;
import ro.sync.exml.workspace.api.PluginResourceBundle;
import ro.sync.exml.workspace.api.PluginWorkspaceProvider;

/**
 * Plugin extension used to handle the configuration of this plugin.
 */
public class WebdavPluginConfigExtension extends PluginConfigExtension {

  private static final String defaultAutoSaveInterval = "5";

  /**
   * Flag indicating whether documents should be locked on open.
   */
  final static String LOCKING_ENABLED = "webdav.lock_on_open";
  
  final static String ENFORCED_URL = "webdav.enforced_url";

  private final static String HIDE_CONNECTOR_TAB = "webdav.hide_connector_tab";

  /**
   * The auto-save interval (in seconds).
   */
  final static String AUTOSAVE_INTERVAL = "webdav.autosave_interval";
  
  @Override
  public void init() throws ServletException {
    super.init();
    HashMap<String, String> defaultOptions = new HashMap<String, String>();
    defaultOptions.put(LOCKING_ENABLED, "on");
    defaultOptions.put(ENFORCED_URL, "");
    defaultOptions.put(AUTOSAVE_INTERVAL, defaultAutoSaveInterval);
    setDefaultOptions(defaultOptions);
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
    String optionValue = getOption(LOCKING_ENABLED, "on");
    boolean isLockEnabled = "on".equals(optionValue);
    String enforcedUrl = getOption(ENFORCED_URL, "");
    String autosaveInterval = getOption(AUTOSAVE_INTERVAL, defaultAutoSaveInterval);
    
    StringBuilder optionsForm = new StringBuilder();
    PluginResourceBundle rb = ((WebappPluginWorkspace)PluginWorkspaceProvider.getPluginWorkspace()).getResourceBundle();
    
    optionsForm.append("<div style='font-family:robotolight, Arial, Helvetica, sans-serif;font-size:0.85em;font-weight: lighter'>")
      .append("<form style='text-align:left;line-height: 1.7em;'>");
    // locking option
    optionsForm.append("<label style='margin-bottom:6px;overflow:hidden'>")
      .append("<input name='").append(LOCKING_ENABLED).append("' type=\"checkbox\" value=\"on\"")
      .append((isLockEnabled ? "checked" : "")).append("> ").append(rb.getMessage(TranslationTags.LOCK_RESOURCES_ON_OPEN))
      .append("</label>");
    // autosave interval
    optionsForm.append("<label style='margin-top:6px;display:block;overflow:hidden'>")
      .append(rb.getMessage(TranslationTags.AUTOSAVE_INTERVAL)).append(": ")
      .append("<input min='0' value='").append(autosaveInterval).append("'name='").append(AUTOSAVE_INTERVAL).append("' type='number'")
      .append("style='width: 50px;text-align:center;'/>")
      .append(" ").append(rb.getMessage(TranslationTags.SECONDS))
      .append("</label>");
    // enforced URL
    optionsForm.append("<label style='margin-top:6px;display:block;'>")
      .append(rb.getMessage(TranslationTags.ENFORCED_SERVER)).append(": ")
      .append("<input placeholder='").append(rb.getMessage(TranslationTags.SERVER_URL)).append("' name='").append(ENFORCED_URL)
      .append("' type='text' style='color:#606060;background-color:#FAFAFA;")
      .append(
        "-webkit-box-sizing: border-box;-moz-box-sizing: border-box;box-sizing: border-box;display: inline-block;")
      .append("width:75%;border-radius:4px;border:1px solid #E4E4E4;padding:6px 4px' value='")
      .append(enforcedUrl).append("'/>")
      .append("</label>");
    // Enforced server note
    optionsForm.append("<div style='background-color: lightyellow;border: 1px solid #dadab4; padding: 8px;margin-top: 5px;'>")
      .append(rb.getMessage(TranslationTags.ENFORCED_SERVER_NOTE))
      .append("</div>");
    
    optionsForm.append("</form>")
      .append("</div>");
    
    return optionsForm.toString();
  }

  /**
   * @see ro.sync.ecss.extensions.api.webapp.plugin.PluginConfigExtension#getOptionsJson().
   */
  @Override
  public String getOptionsJson() {
    return "{"
        + "\"hide_connector_tab\":\"" + getOption(HIDE_CONNECTOR_TAB, "") + "\"," 
        + "\"webdav_autosave_interval\":\"" + getOption(AUTOSAVE_INTERVAL, defaultAutoSaveInterval) + "\","
        + "\"enforced_webdav_server\":\"" + getOption(ENFORCED_URL, "") + "\"," 
        + "\"lock_on_open\":\"" + getOption(LOCKING_ENABLED, "on")
        + "\"}";
  }
}
