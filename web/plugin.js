(function(){

  /**
   * Login the user and call this callback at the end.
   *
   * @param {function} authenticated The callback when the user was authenticated - successfully or not.
   */
  function login(authenticated) {
    // pop-up an authentication window,
    var dialog1 = workspace.createDialog();
    dialog1.getElement().innerHTML =
      '<div class="webdav-login-dialog">' +
      '<label>Name: <input id="webdav-name" type="text" autocorrect="off" autocapitalize="none" autofocus/></label>' +
      '<label>Password: <input id="webdav-passwd" type="password"/></label>' +
      '</div>';
    dialog1.setTitle('Authentication Required');
    dialog1.setPreferredSize(300, null);
    dialog1.show();

    dialog1.onSelect(function (key) {
      if (key == 'ok') {
        // Send the user and password to the login servlet which runs in the webapp.
        var user = document.getElementById('webdav-name').value;
        var passwd = document.getElementById('webdav-passwd').value;
        goog.net.XhrIo.send(
          '../plugins-dispatcher/login?user=' + encodeURIComponent(user) + "&passwd=" + encodeURIComponent(passwd),
          authenticated,
          'POST');
      }
      dialog1.dispose();
    });
  }

  goog.events.listen(workspace, sync.api.Workspace.EventType.BEFORE_EDITOR_LOADED, function(e) {
    var url = e.options.url;
    // If the URL starts with http:, use thw webdav protocol handler.

    e.options.url = url;

    if (url.match(/^webdav-https?:/)) {
      goog.events.listen(workspace, sync.api.Workspace.EventType.EDITOR_LOADED, function(e) {
        workspace.setUrlChooser(fileBrowser);
      });

      // The editor is about to be loaded.
      var editor = e.editor;
      // Listen for messages sent from the server-side code.
      goog.events.listen(editor, sync.api.Editor.EventTypes.CUSTOM_MESSAGE_RECEIVED, function(e) {
        var context = e.context;

        // pop-up an authentication window,
        login(function() {
          // After the user was logged in, retry the operation that failed.
          if (context == sync.api.Editor.WebappMessageReceived.Context.LOAD) {
            // If the document was loading, we try to reload the whole webapp.
            window.location.reload();
          } else if (context == sync.api.Editor.WebappMessageReceived.Context.EDITING) {
            // During editing, only references can trigger re-authentication. Refresh them.
            editor.getActionsManager().invokeAction('Author/Refresh_references');
          } else if (context == sync.api.Editor.WebappMessageReceived.Context.SAVE) {
            // Currently there is no API to re-try saving, but it will be.
            editor.getActionsManager().getActionById('Author/Save').actionPerformed(function() {});
          } else if (context == sync.api.Editor.WebappMessageReceived.Context.IMAGE) {
            // The browser failed to retrieve an image - reload it.
            var images = document.querySelectorAll('img[data-src]');
            for (var i = 0; i < images.length; i++) {
              images[i].src = goog.dom.dataset.get(images[i], 'src');
            }
          }
        });
      });
    }
  });

  // A webdav-specific file browser.
  var WebdavFileBrowser = function() {
    var latestUrl = this.getLatestUrl();
    sync.api.FileBrowsingDialog.call(this, {
      initialUrl: latestUrl,
      root: this.getLatestRootUrl()
    });

    // whether the webdav server plugin is installed.
    setTimeout(goog.bind(function(){
      this.isServerPluginInstalled = false;
    	if(typeof webdavServerPluginUrl !== 'undefined' && webdavServerPluginUrl) {
	      this.isServerPluginInstalled = true;
      }
    }, this), 0);
  };
  goog.inherits(WebdavFileBrowser, sync.api.FileBrowsingDialog);

  /** @override */
  WebdavFileBrowser.prototype.renderRepoPreview = function(element) {
    var url = this.getCurrentFolderUrl();
    if (url) {
      element.style.paddingLeft = '5px';
      element.title = "Server URL";
      element.innerHTML = '<div class="domain-icon" style="' +
        'background-image: url(' + sync.util.getImageUrl('/images/SharePointWeb16.png', sync.util.getHdpiFactor()) + ');"></div>' +
        new sync.util.Url(url).getDomain() +
        '<div class="webdav-domain-edit"></div>';
      var button = element.querySelector('.webdav-domain-edit');
      button.title = "Edit server URL";
      goog.events.listen(button, goog.events.EventType.CLICK,
        goog.bind(this.switchToRepoConfig, this, element))
    }
    this.dialog.setPreferredSize(null, 460);
  };

  /** @override */
  WebdavFileBrowser.prototype.renderRepoEditing = function(element) {
    var url = this.getCurrentFolderUrl();
    var latestUrl = this.getLatestUrl();
    // if none was set we let it empty.
    var editUrl = latestUrl || url || '';
    if (editUrl && (editUrl.indexOf('webdav-') == 0)) {
      editUrl = editUrl.substring(7);
    }
    var button = element.querySelector('.webdav-domain-edit');
    element.title = "";
    goog.events.removeAll(button);

    element.style.paddingLeft = '5px';
    // the webdavServerPlugin additional content.
    var wevdavServerPluginContent = '';
    // if the webdav-server-plugin is installed display a button to use it.
    if(this.isServerPluginInstalled) {
      wevdavServerPluginContent =
        '<div class="webdav-builtin-server">' +
        '<div class="webdav-use-builtin-btn">Use builtin server</div>' +
        '<input disabled class="webdav-builtin-url" value="' + webdavServerPluginUrl + '">' +
        '</div>';
    }

    element.innerHTML =
      '<div class="webdav-config-dialog">' +
      '<label>Server URL: <input id="webdav-browse-url" type="text" autocorrect="off" autocapitalize="none" autofocus/></label>' +
      wevdavServerPluginContent +
      '</div>';
    element.querySelector('#webdav-browse-url').value = editUrl;

    // handle click on the Use builtin server button.
    if(this.isServerPluginInstalled) {
      var useBuiltinServerBtn = element.querySelector('.webdav-builtin-server .webdav-use-builtin-btn');
      goog.events.listen(useBuiltinServerBtn, goog.events.EventType.CLICK,
        goog.bind(function(){
          // set the builtin server url in the url config input field.
          this.openUrl(webdavServerPluginUrl, false);
        }, this));
    }

    var prefferedHeight = this.isServerPluginInstalled ? 230 : 190;
    this.dialog.setPreferredSize(null, prefferedHeight);
  };

  /** @override */
  WebdavFileBrowser.prototype.handleOpenRepo = function(element, e) {
    var url = document.getElementById('webdav-browse-url').value;
    // if an url was provided we instantiate the file browsing dialog.
    if(url) {
      var processedUrl = this.processURL(url);
      this.requestUrlInfo_(processedUrl);
    }
    e.preventDefault();
  };

  /**
   * Request the URL info from the server.
   *
   * @param {string} url The URL about which we ask for information.
   *
   * @private
   */
  WebdavFileBrowser.prototype.requestUrlInfo_ = function (url) {
    goog.net.XhrIo.send(
      '../plugins-dispatcher/webdav-url-info?url=' + encodeURIComponent(url),
      goog.bind(this.handleUrlInfoReceived, this, url));
  };

  /**
   * URL information received from the server, we can open that URL in the dialog.
   *
   * @param {string} url The URL about which we requested info.
   * @param {goog.events.Event} e The XHR event.
   */
  WebdavFileBrowser.prototype.handleUrlInfoReceived = function (url, e) {
    var request = /** {@type goog.net.XhrIo} */ (e.target);
    var status = request.getStatus();

    if (status == 200) {
      var info = request.getResponseJson();
      var isFile = info.type === 'FILE';
      // Make sure folder urls end with '/'.
      if (!isFile && url.lastIndexOf('/') !== url.length - 1) {
        url = url + '/';
      }
      
      var rootUrl = this.processURL(info.rootUrl);
      var urlObj = new sync.util.Url(url);
      localStorage.setItem('webdav.latestUrl', urlObj.getFolderUrl());
      localStorage.setItem('webdav.latestRootUrl', rootUrl);

      this.setRootUrl(rootUrl);
      this.openUrl(url, isFile, null);
    } else if (status == 401) {
      login(goog.bind(this.requestUrlInfo_, this, url));
    } else {
      this.showErrorMessage('Cannot open this URL');
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
    return processedUrl;
  };

  /**
   *
   * @return {string} the latest root url.
   */
  WebdavFileBrowser.prototype.getLatestRootUrl = function() {
    var lastRootUrl = localStorage.getItem('webdav.latestRootUrl');
    if (!lastRootUrl && this.isServerPluginInstalled) {
      lastRootUrl = webdavServerPluginUrl;
    }
    return lastRootUrl;
  };

  /**
   * Getter of the last usedUrl.
   *
   * @return {String} the last set url.
   */
  WebdavFileBrowser.prototype.getLatestUrl = function() {
    var latestUrl = localStorage.getItem('webdav.latestUrl');
    // if the latest url is not in local storage we check if the
    // webdav-server-plugin is installed and we use it.
    if(!latestUrl && this.isServerPluginInstalled) {
      latestUrl = webdavServerPluginUrl;
    }

    return latestUrl;
  };

  /**
   * Register all the needed listeners on the file browser.
   *
   * @param {sync.api.FileBrowsingDialog} fileBrowser
   *  the file browser on which to listen.
   */
  var registerFileBrowserListeners = function(fileBrowser) {
    // handle the user action required event.
    var eventTarget = fileBrowser.getEventTarget();
    goog.events.listen(eventTarget,
      sync.api.FileBrowsingDialog.EventTypes.USER_ACTION_REQUIRED,
      function () {
        login(function() {
            fileBrowser.refresh();
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