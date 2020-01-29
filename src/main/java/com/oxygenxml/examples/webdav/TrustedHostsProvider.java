package com.oxygenxml.examples.webdav;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.concurrent.atomic.AtomicReference;

import org.apache.log4j.Logger;

import ro.sync.exml.plugin.workspace.security.Response;
import ro.sync.exml.plugin.workspace.security.TrustedHostsProviderExtension;
import ro.sync.exml.workspace.api.PluginWorkspaceProvider;
import ro.sync.exml.workspace.api.options.WSOptionChangedEvent;
import ro.sync.exml.workspace.api.options.WSOptionListener;
import ro.sync.exml.workspace.api.options.WSOptionsStorage;

/**
 * {@link TrustedHostsProviderExtension} implementation that trust imposed host.
 */
public class TrustedHostsProvider implements TrustedHostsProviderExtension {
  /**
   * Logger for logging.
   */
  private static Logger logger = Logger.getLogger(TrustedHostsProvider.class.getName());

  /**
   * Enforced host.
   */
  private AtomicReference<String> enforcedHostRef = new AtomicReference<>(null);

  /**
   * Constructor.
   */
  public TrustedHostsProvider() {
    WSOptionsStorage optionsStorage = PluginWorkspaceProvider.getPluginWorkspace().getOptionsStorage();
    updateEnforcedHost(optionsStorage);

    optionsStorage.addOptionListener(new WSOptionListener(WebdavPluginConfigExtension.ENFORCED_URL) {
      @Override
      public void optionValueChanged(WSOptionChangedEvent event) {
        updateEnforcedHost(optionsStorage);
      }
    });
  }

  /**
   * Update the enforced host field.
   */
  private void updateEnforcedHost(WSOptionsStorage optionsStorage) {
    this.enforcedHostRef.set(null);

    String enforcedUrl = optionsStorage.getOption(WebdavPluginConfigExtension.ENFORCED_URL, "");
    if (enforcedUrl != null && !enforcedUrl.isEmpty()) {
      try {
        URL url = new URL(enforcedUrl);
        this.enforcedHostRef.set(url.getHost() + ":" + (url.getPort() != -1 ? url.getPort() : url.getDefaultPort()));
      } catch (MalformedURLException e) {
        logger.warn(e, e);
      }
    }
  }

  @Override
  public Response isTrusted(String hostName) {
    String enforcedHost = this.enforcedHostRef.get();
    if (hostName.equals(enforcedHost)) {
      return TrustedHostsProvider.TRUSTED;
    } else {
      return TrustedHostsProvider.UNKNOWN;
    }
  }
}
