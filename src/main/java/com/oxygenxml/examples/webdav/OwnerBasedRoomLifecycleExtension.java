package com.oxygenxml.examples.webdav;

import ro.sync.servlet.collaboration.OwnerBasedRoomLifecycleExtensionBase;

/**
 * Close room when initiator leaves.
 */
public class OwnerBasedRoomLifecycleExtension extends OwnerBasedRoomLifecycleExtensionBase {
  /**
   * Constructor.
   */
  public OwnerBasedRoomLifecycleExtension() {
    super(WebdavURLHandlerExtension.WEBDAV);
  }
}
