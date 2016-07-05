(function() {
  /**
   *  Wrapper over the old save action that displays autosave status.
   *
   * @param {sync.actions.AbstractAction} saveAction the old save action.
   *
   * @constructor
   */
  var SaveWrapperAction = function(saveAction) {
    sync.actions.AbstractAction.call('');
    this.statusMarker = null;
    this.saveAction = saveAction;
  };
  goog.inherits(SaveWrapperAction, sync.actions.AbstractAction);

  /** @override */
  SaveWrapperAction.prototype.actionPerformed = function(opt_callback) {
    this.markClean();
    this.saveAction.actionPerformed(opt_callback);
  };

  /** @override */
  SaveWrapperAction.prototype.getDisplayName = function() {
    return this.saveAction.getDisplayName();
  };

  /** @override */
  SaveWrapperAction.prototype.renderLargeIcon = function() {
    var icon = this.saveAction.renderLargeIcon();

    var status = document.createElement('div');
    goog.dom.classlist.add(status, 'autosave-status-icon');
    goog.dom.appendChild(icon, status);
    this.statusMarker = status;

    icon.style.position = 'relative';
    return icon;
  };

  /** @override */
  SaveWrapperAction.prototype.getDescription = function() {
    return this.saveAction.getDescription();
  };

  /** @override */
  SaveWrapperAction.prototype.isEnabled = function() {
    return this.saveAction.isEnabled();
  };

  /** Marks the save icon as save */
  SaveWrapperAction.prototype.markClean = function() {
    this.statusMarker.style.backgroundColor = 'green';
  };

  /** Marks the save icon as dirty */
  SaveWrapperAction.prototype.markDirty = function() {
    this.statusMarker.style.backgroundColor = 'yellow';
  };

  /** Marks the save icon as saving */
  SaveWrapperAction.prototype.markSaving = function() {
    this.statusMarker.style.backgroundColor = 'blue';
  };

  /** Marks the save icon as failed */
  SaveWrapperAction.prototype.markFailed = function() {
    this.statusMarker.style.backgroundColor = 'red';
  };

  // AutoSave
  var autoSaveInterval = parseInt(sync.options.PluginsOptions.getClientOption('webdav_autosave_interval'));
  if (autoSaveInterval > 0) {
    goog.events.listen(workspace, sync.api.Workspace.EventType.BEFORE_EDITOR_LOADED, function(e) {
      /** Execute only for WebDAV URLs */
      if( !e.options.url.match(/^webdav-https?:/)) {
        return;
      }

      // The editor is about to be loaded.
      var editor = e.editor;

      // wrap the toolbar save action.
      goog.events.listenOnce(editor, sync.api.Editor.EventTypes.ACTIONS_LOADED, function(e) {
        var toolbarActions = e.actionsConfiguration.toolbars[0].children;
        var i;
        for(i = 0; i < toolbarActions.length; i++) {
          if(toolbarActions[i].id == 'Author/Save') {
            // override the save action from the toolbar
            var editor = e.target;
            var actionsManager = editor.getActionsManager();
            var saveAction = actionsManager.getActionById('Author/Save');
            var autoSaveAction = new SaveWrapperAction(saveAction);
            actionsManager.registerAction('Author/Save', autoSaveAction);
          }
        }
      });

      // autosave at given interval every time the editor becomes dirty.
      goog.events.listen(editor, sync.api.Editor.EventTypes.DIRTY_STATUS_CHANGED, function(e) {
        if (e.isDirty) {
          var autosaveAction = editor.getActionsManager().getActionById('Author/Save');
          autosaveAction.markDirty();
          setTimeout(function() {
            if (editor.isDirty()) {
              autosaveAction.markSaving();

              sync.rest.callAsync(RESTDocumentManager.autosave, {id: editor.docId})
                .then(function(e) {
                  editor.setDirty(false);
                  autosaveAction.markClean();
                })
                .thenCatch(function(e) {
                  autosaveAction.markFailed();
                  console.log('Failed autosaving the file');
                })
            }
          }, autoSaveInterval * 1000); // transform in miliseconds.
        }
      });
    });
  }
})();