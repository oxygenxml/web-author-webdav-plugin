(function(){
  goog.events.listen(workspace, sync.api.Workspace.EventType.BEFORE_EDITOR_LOADED, function(e) {
    var url = e.options.url;
    // If the URL starts with http:, use thw webdav protocol handler.

    e.options.url = url;

    if (url.match(/^webdav-https?:/)) {
      goog.events.listen(workspace, sync.api.Workspace.EventType.EDITOR_LOADED, function(e) {
        workspace.setUrlChooser(new sync.api.FileBrowsingDialog({
          initialUrl: url
        }));
      });

      // The editor is about to be loaded.
      var editor = e.editor;
      // Listen for messages sent from the server-side code.
      goog.events.listen(editor, sync.api.Editor.EventTypes.CUSTOM_MESSAGE_RECEIVED, function(e) {
        var context = e.context;

        // pop-up an authentication window,
        var dialog1 = workspace.createDialog();
        dialog1.getElement().innerHTML =
          '<div class="webdav-login-dialog">' +
            '<label>Name: <input id="webdav-name" type="text" autocorrect="off" autocapitalize="none" /></label>' +
            '<label>Password: <input id="webdav-passwd" type="password"/></label>' +
          '</div>';
        dialog1.setTitle('Authentication Required');
        dialog1.show();

        dialog1.onSelect(function(key) {
          if (key == 'ok') {
            // Send the user and password to the login servlet which runs in the webapp.
            var user = document.getElementById('webdav-name').value;
            var passwd = document.getElementById('webdav-passwd').value;
            var request = new goog.net.XhrIo();
            request.send('../plugins-dispatcher/login?user=' + encodeURIComponent(user) + "&passwd=" + encodeURIComponent(passwd), 'POST');

            goog.events.listenOnce(request, goog.net.EventType.COMPLETE, function() {
              // After the user was logged in, retry the operation that failed.
              if (context == sync.api.Editor.WebappMessageReceived.Context.LOAD) {
                // If the document was loading, we try to reload the whole webapp.
                window.location.reload();
              } else if (context == sync.api.Editor.WebappMessageReceived.Context.EDITING) {
                // During editing, only references can trigger re-authentication. Refresh them.
                editor.getActionsManager().invokeAction('Author/Refresh_references');
              } else if (context == sync.api.Editor.WebappMessageReceived.Context.SAVE) {
                // Currently there is no API to re-try saving, but it will be.
                editor.getActionsManager().invokeAction('Author/Save', function() {});
              } else if (context == sync.api.Editor.WebappMessageReceived.Context.IMAGE) {
                // The browser failed to retrieve an image - reload it.
                var images = document.querySelectorAll('img[data-src]');
                for (var i = 0; i < images.length; i++) {
                  images[i].src = goog.dom.dataset.get(images[i], 'src');
                }
              }
            });
          }
        });
      });
    }
  });

  // A webdav-specific file browser.
  WebdavFileBrowser = function() {
    var latestUrl = localStorage.getItem('webdav.latestUrl');
    sync.api.FileBrowsingDialog.call(this, {
      initialUrl: latestUrl
    });
  };
  goog.inherits(WebdavFileBrowser, sync.api.FileBrowsingDialog);

  /** @override */
  WebdavFileBrowser.prototype.renderRepoPreview = function(element) {
    var url = this.getCurrentFolderUrl();
    if (url) {
      element.style.paddingLeft = '5px';
      element.title = "Server URL";
      goog.dom.classlist.add(element, 'vertical-align-children');
      element.innerHTML = '<div class="domain-icon" style="' +
        'background-image: url(' + sync.util.getImageUrl('/images/SharePointWeb16.png', sync.util.getHdpiFactor()) + ');"></div>' +
        new sync.util.Url(url).getDomain() +
        '<div class="webdav-domain-edit"></div>';
      var button = element.querySelector('.webdav-domain-edit');
      button.title = "Edit server URL";
      goog.events.listen(button, goog.events.EventType.CLICK,
        goog.bind(this.switchToRepoConfig, this, element))
    }
  };

  /** @override */
  WebdavFileBrowser.prototype.renderRepoEditing = function(element) {
    var url = this.getCurrentFolderUrl();
    var latestUrl = localStorage.getItem('webdav.latestUrl');
    // if none was set we let it empty.
    var editUrl = url || latestUrl || '';
    if (editUrl && (editUrl.indexOf('webdav-') == 0)) {
      editUrl = editUrl.substring(7);
    }
    var button = element.querySelector('.webdav-domain-edit');
    element.title = "";
    goog.events.removeAll(button);

    element.style.paddingLeft = '5px';
    element.innerHTML =
            '<div class="webdav-config-dialog">' +
              '<label>Server URL: <input id="webdav-browse-url" type="text" autocorrect="off" autocapitalize="none" autofocus/></label>' +
            '</div>';
    element.querySelector('#webdav-browse-url').value = editUrl;
  };

  /** @override */
  WebdavFileBrowser.prototype.handleOpenRepo = function(element, e) {
    var url = document.getElementById('webdav-browse-url').value;
    // if an url was provided we instantiate the file browsing dialog.
    if(url) {
      var processedUrl = this.processURL(url);
      localStorage.setItem('webdav.latestUrl', processedUrl);
      // if a file name was provided we transfer it.
      var fileName = this.getFileName();
      if (fileName) {
        processedUrl += fileName;
      }
      this.openUrl(processedUrl, false, e);
    }
  };


  /**
   * Further processes the url.
   *
   * @param url the url to process.
   *
   * @return {string} the processed url.
   */
  WebdavFileBrowser.prototype.processURL = function(url) {
    var processedUrl = url;

    // if the url does not start with 'webdav' prepend it to the url.
    if(!(url.indexOf('webdav-') == 0)) {
      processedUrl = 'webdav-' + processedUrl;
    }
    // if the url does not end in a '/' we add it.
    if(!(processedUrl.substring(processedUrl.length - 1) ==  "/")) {
      processedUrl = processedUrl + "/"
    }
    return processedUrl;
  };

  /**
   * Register all the needed listeners on the file browser.
   *
   * @param {sync.api.FileBrowsingDialog} fileBrowser
   *  the file browser on which to listen.
   */
  var registerFileBrowserListeners = function (fileBrowser) {
    // handle the user action required event.
    var eventTarget = fileBrowser.getEventTarget();
    goog.events.listen(eventTarget,
        sync.api.FileBrowsingDialog.EventTypes.USER_ACTION_REQUIRED,
        function () {
          var loginDialog = workspace.createDialog();
          loginDialog.getElement().innerHTML =
              '<div class="webdav-login-dialog">' +
                '<label>Name: <input id="webdav-browse-name" type="text" autocorrect="off" autocapitalize="none" autofocus /></label>' +
                '<label>Password: <input id="webdav-browse-passwd" type="password"/></label>' +
              '</div>';
          loginDialog.setTitle('Login');

          loginDialog.show();

          loginDialog.onSelect(function (key) {
            if (key == 'ok') {
              // Send the user and password to the login servlet.
              var user = document.getElementById('webdav-browse-name').value;
              var passwd = document.getElementById('webdav-browse-passwd').value;
              var request = new goog.net.XhrIo();
              request.send('../plugins-dispatcher/login?user=' + encodeURIComponent(user) + "&passwd=" + encodeURIComponent(passwd), 'POST');
              // the login servlet response
              goog.events.listenOnce(request, goog.net.EventType.COMPLETE,
                  function (e) {
                    if (e.type == 'complete') {
                      fileBrowser.refresh();
                    }
                  });
            }
            loginDialog.dispose();
          });
        });
  };

  // create the connection configurator.
  var fileBrowser = new WebdavFileBrowser();

  // register all the listeners on the file browser.
  registerFileBrowserListeners(fileBrowser);
  // the large icon url, hidpi enabled.
  var iconUrl = sync.util.computeHdpiIcon('../plugin-resources/webdav/Webdav70.png');

  var webdavOpenAction = new sync.actions.OpenAction(fileBrowser);
  webdavOpenAction.setLargeIcon(iconUrl);
  webdavOpenAction.setDescription('Open document from WebDAV server');
  webdavOpenAction.setActionId('webdav-open-action');
  webdavOpenAction.setActionName('WebDAV');

  var webdavCreateAction = new sync.api.CreateDocumentAction(fileBrowser);
  webdavCreateAction.setLargeIcon(iconUrl);
  webdavCreateAction.setDescription('Create a new document on a WebDAV server');
  webdavCreateAction.setActionId('webdav-create-action');
  webdavCreateAction.setActionName('WebDAV');

  var actionsManager = workspace.getActionsManager();
  actionsManager.registerOpenAction(webdavOpenAction);
  actionsManager.registerCreateAction(webdavCreateAction);

  sync.util.loadCSSFile("../plugin-resources/webdav/webdav.css");
})();