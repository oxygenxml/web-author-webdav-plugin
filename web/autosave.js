(function() {
  /**
   *  Wrapper over the old save action that displays autosave status.
   *
   * @param {sync.actions.AbstractAction} saveAction the old save action.
   * @param {sync.api.Editor} editor the current editor.
   * @param {number} inteval the autosave interval.
   *
   * @constructor
   */
  var SaveWrapperAction = function(editor, saveAction, saveInterval) {
    sync.actions.AbstractAction.call('');
    this.statusMarker = document.querySelector('.modified-indicator');
    goog.dom.classlist.add(this.statusMarker, 'autosave');
    this.saveAction = saveAction;
    this.editor = editor;
    this.interval = saveInterval;
    // the last state class added.
    this.lastClassAdded = null;

    goog.events.listen(this.statusMarker, goog.events.EventType.CLICK,
      goog.bind(this.statusMarkerClicked, this));

    // autosave at given interval every time the editor becomes dirty.
    goog.events.listen(this.editor, sync.api.Editor.EventTypes.DIRTY_STATUS_CHANGED, goog.bind(function(e) {
      if (e.isDirty) {
        this.setStatus('dirty');
        setTimeout(goog.bind(function() {
          if (this.editor.isDirty()) {
            this.setStatus('saving');

            sync.rest.callAsync(RESTDocumentManager.autosave, {id: this.editor.docId})
              .then(goog.bind(function(e) {
                this.editor.setDirty(false);
                this.setStatus('clean');
              }, this))
              .thenCatch(goog.bind(function(e) {
                this.setStatus('error');
              }, this))
          }
        }, this), this.interval * 1000); // transform in miliseconds.
      }
    }, this));
  };
  goog.inherits(SaveWrapperAction, sync.actions.AbstractAction);

  /** @override */
  SaveWrapperAction.prototype.actionPerformed = function(opt_callback) {
    this.setStatus('clean');
    this.saveAction.actionPerformed(opt_callback);
  };

  /** @override */
  SaveWrapperAction.prototype.getDisplayName = function() {
    return this.saveAction.getDisplayName();
  };

  /** @override */
  SaveWrapperAction.prototype.renderLargeIcon = function() {
    var icon = this.saveAction.renderLargeIcon();
    this.setStatus('clean');
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

  /**
   * Marks the autosave status
   *
   * @param {string} newStatus the new status to set.
   */
  SaveWrapperAction.prototype.setStatus = function(newStatus) {
    if (this.interval <= 5) {
      if(this.lastStatus == newStatus) {
        return;
      }
      this.lastStatus = newStatus;
      switch (newStatus) {
        case 'clean':
          goog.dom.classlist.remove(this.statusMarker, this.lastClassAdded);
          this.lastClassAdded = 'autosave-status-clean';
          goog.dom.classlist.add(this.statusMarker, this.lastClassAdded);
          this.statusMarker.innerHTML = ' - saved';
          this.statusMarker.title = 'All changes were saved.';
          break;

        case 'error':
          goog.dom.classlist.remove(this.statusMarker, this.lastClassAdded);
          this.lastClassAdded = 'autosave-status-error';
          goog.dom.classlist.add(this.statusMarker, this.lastClassAdded);
          this.statusMarker.innerHTML = ' - save failed';
          this.statusMarker.title = 'Failed saving your changes.';
          this.showRetryDialog();

          break;
        case 'dirty':
          goog.dom.classlist.remove(this.statusMarker, this.lastClassAdded);
          this.lastClassAdded = 'autosave-status-dirty';
          goog.dom.classlist.add(this.statusMarker, this.lastClassAdded);
          this.statusMarker.innerHTML = '*';
          this.statusMarker.title = 'The document contains unsaved changes.';

          break;
        case 'saving':
          goog.dom.classlist.remove(this.statusMarker, this.lastClassAdded);
          this.lastClassAdded = 'autosave-status-saving';
          goog.dom.classlist.add(this.statusMarker, this.lastClassAdded);
          this.statusMarker.innerHTML = 'saving...';
          this.statusMarker.title = 'Saving your changes.';

          break;
      }
    } else {
      // for larger intervals we give feedback just for saving.
      if (! this.spinner) {
        var saveButton = document.querySelector('*[name="Author/Save"]');
        if (saveButton) {
          this.spinner = new sync.view.Spinner(saveButton, 0, 'oxy-spinner-dark-background');
        }
      }
      switch (newStatus) {
        case 'saving':
          this.spinner && this.spinner.show();
          break;
        default:
          this.spinner && this.spinner.hide();
      }
    }
  };

  /**
   * Handler for click events on status marker.
   */
  SaveWrapperAction.prototype.statusMarkerClicked = function() {
    if(this.lastStatus == 'error') {
      this.showRetryDialog();
    }
  };

  /**
   * Show a dialog to alow the user to retry the save.
   */
  SaveWrapperAction.prototype.showRetryDialog = function() {
    if (! this.failedDialog) {
      this.failedDialog = workspace.createDialog();
      this.failedDialog.setButtonConfiguration([{key: 'retry', caption: 'Retry'}, {key: 'cancel', caption: 'Cancel'}]);
      this.failedDialog.setTitle('Autosave failed');
      this.failedDialog.getElement().innerHTML =
        'The automatic save has failed.<br>' +
        'Retry saving the document to prevent losing your current changes.<br>' +
        'If retry fails, try the <a href="#" class="autosave-failed-save-as">Save as</a> or <a href="#" class="autosave-failed-download">Download</a> actions to save your changes.';

      var callback = function() {};
      // call Save as action on click
      var saveAs = this.failedDialog.getElement().querySelector('.autosave-failed-save-as');
      goog.events.listen(saveAs, goog.events.EventType.CLICK, goog.bind(function() {
        var saveAsAction = this.editor.getActionsManager().getActionById('Author/SaveAs');
        this.failedDialog.hide();
        saveAsAction.actionPerformed(callback);
      }, this));

      // call download action on click
      var download = this.failedDialog.getElement().querySelector('.autosave-failed-download');
      goog.events.listen(download, goog.events.EventType.CLICK, goog.bind(function() {
        var downloadAction = this.editor.getActionsManager().getActionById('Author/Download');
        this.failedDialog.hide();
        downloadAction.actionPerformed(callback);
      }, this));
    }

    this.failedDialog.onSelect(goog.bind(function(key) {
      if (key == 'retry') {
        this.saveAction.actionPerformed(function() {
        });
      }
    }, this));
    this.failedDialog.show();
  };

  /** BEFORE_EDITOR_LOADED */
  goog.events.listen(workspace, sync.api.Workspace.EventType.BEFORE_EDITOR_LOADED, function(e) {
    var autoSaveInterval = parseInt(sync.options.PluginsOptions.getClientOption('webdav_autosave_interval'));
    if (e.options.url.match(/^webdav-https?:/) && autoSaveInterval > 0) {
      /** ACTIONS_LOADED */
      goog.events.listenOnce(e.editor, sync.api.Editor.EventTypes.ACTIONS_LOADED, function(e) {
        var toolbarActions = e.actionsConfiguration.toolbars[0].children;
        if (autoSaveInterval <= 5) {
          // hide the save action for small intervals.
          var i;
          for (i = 0; i < toolbarActions.length; i ++) {
            if (toolbarActions[i].id == 'Author/Save') {
              toolbarActions.splice(i, 1);
            }
          }
        }
        // override the save action from the toolbar
        var editor = e.target;
        var actionsManager = editor.getActionsManager();
        var saveAction = actionsManager.getActionById('Author/Save');
        var autoSaveAction = new SaveWrapperAction(editor, saveAction, autoSaveInterval);
        actionsManager.registerAction('Author/Save', autoSaveAction);
      });
    }
  });
})();