(function() {
  /** BEFORE_EDITOR_LOADED */
  goog.events.listen(workspace, sync.api.Workspace.EventType.BEFORE_EDITOR_LOADED, function(e) {
    var autoSaveInterval = parseInt(sync.options.PluginsOptions.getClientOption('webdav_autosave_interval'));
    if (e.options.url.match(/^webdav-https?:/)) {
      e.options.autoSaveInterval = autoSaveInterval;
    }
  });
})();