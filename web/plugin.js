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
                alert('Please retry saving the document');
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

  goog.provide('WebdavConnectionConfigurator');

  /**
   * Handles the webdav connection configuration.
   * @constructor
   */
  WebdavConnectionConfigurator = function() {
    sync.api.FileBrowsingDialog.FileRepositoryConnectionConfigurator.call(this);
    this.configDialog = null;
  };
  goog.inherits(WebdavConnectionConfigurator,
      sync.api.FileBrowsingDialog.FileRepositoryConnectionConfigurator);

  /**
   *  Handle the connection configurations.
   *
   * @param currentUrl the file browser's current url.
   * @param fileName the current file name.
   * @param callback callback method to call with the new options.
   */
  WebdavConnectionConfigurator.prototype.configureConnection = function(currentUrl, fileName, callback) {
    this.showConfigDialog(currentUrl);

    this.configDialog.onSelect(goog.bind(function (key, e) {
      if (key == 'ok') {
        var url = document.getElementById('webdav-browse-url').value;
        // if an url was provided we instantiate the file browsing dialog.
        if(url) {
          localStorage.setItem('webdav.latestUrl', url);
          var processedUrl = this.processURL(url);
          // if a file name was provided we transfer it.
          if(fileName) {
            processedUrl += fileName;
          }

          callback({
            initialUrl: processedUrl
          });
        } else {
          // call the callback with no options.
          callback();
        }
      }
    }, this));
  };

  /**
   * Display the configuration dialog.
   *
   * @param {Object=} currentUrl the optional current url.
   */
  WebdavConnectionConfigurator.prototype.showConfigDialog = function(currentUrl) {
    // create the dialog if it is null.
    if(this.configDialog == null) {
      this.configDialog = workspace.createDialog();
      this.configDialog.getElement().innerHTML =
          '<div class="webdav-config-dialog">' +
            '<label>URL: <input id="webdav-browse-url" type="text" autocorrect="off" autocapitalize="none" autofocus/></label>' +
          '</div>';
      this.configDialog.setTitle('Configure WebDAV connection');
    }

    var latestUrl = localStorage.getItem('webdav.latestUrl');
    document.getElementById('webdav-browse-url').value = currentUrl || latestUrl;
    this.configDialog.show();
  };

  /**
   * Further processes the url.
   *
   * @param url the url to process.
   *
   * @return {string=} the processed url.
   */
  WebdavConnectionConfigurator.prototype.processURL = function(url) {
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
  var connectionConfigurator = new WebdavConnectionConfigurator();
  var fileBrowser = new sync.api.FileBrowsingDialog({
    fileRepositoryConnectionConfigurator: connectionConfigurator
  });

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

  /**
   * Loads the webdav-specific CSS.
   */
  var url = "../plugin-resources/webdav/webdav.css";
  if (document.createStyleSheet) {
    document.createStyleSheet(url);
  } else {
    var link = goog.dom.createDom('link', {
      href: url,
      rel: "stylesheet",
      type: "text/css"
    });
    goog.dom.appendChild(document.head, link);
  }
})();