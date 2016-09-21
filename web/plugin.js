(function() {
  /**
   * Login the user and call this callback at the end.
   *
   * @param {String} serverUrl the server that we are logging in url.
   * @param {function} authenticated The callback when the user was authenticated - successfully or not.
   */
  var loginDialog_ = null;
  function login(serverUrl, authenticated) {
    serverUrl = fileBrowser.processURL(serverUrl);
    localStorage.removeItem('webdav.user');

    // pop-up an authentication window,
    if (!loginDialog_) {
      loginDialog_ = workspace.createDialog();
      loginDialog_.getElement().innerHTML =
        '<div class="webdav-login-dialog">' +
        '<label>Name: <input id="webdav-name" type="text" autocorrect="off" autocapitalize="none" autofocus/></label>' +
        '<label>Password: <input id="webdav-passwd" type="password"/></label>' +
        '</div>';
      loginDialog_.setTitle('Authentication Required');
      loginDialog_.setPreferredSize(300, null);
    }

    loginDialog_.show();
    loginDialog_.onSelect(function(key) {
      if (key == 'ok') {
        // Send the user and password to the login servlet which runs in the webapp.
        var user = document.getElementById('webdav-name').value.trim();
        var passwd = document.getElementById('webdav-passwd').value;

        goog.net.XhrIo.send(
          '../plugins-dispatcher/login',
          function () {
            localStorage.setItem('webdav.user', user);

            fileBrowser.username = user;
            authenticated();
          },
          'POST',
          // form params
          goog.Uri.QueryData.createFromMap(new goog.structs.Map({
            user: user,
            passwd: passwd,
            server: serverUrl
          })).toString()
        );
      }
    });
  }

  goog.events.listen(workspace, sync.api.Workspace.EventType.BEFORE_EDITOR_LOADED, function(e) {
    var url = e.options.url;
    // If the URL starts with http:, use thw webdav protocol handler.
    if (url.match(/^webdav-https?:/)) {
      var loggedInUser = localStorage.getItem('webdav.user');
      if (loggedInUser) {
        e.options.userName = loggedInUser;
      }
      // set the workspace UrlChooser
      workspace.setUrlChooser(fileBrowser);

      // The editor is about to be loaded.
      var editor = e.editor;

      // Register the toolbar actions.
      goog.events.listenOnce(editor, sync.api.Editor.EventTypes.ACTIONS_LOADED, function(e) {
        var logoutAction = new LogOutAction(editor);
        var logoutActionId = 'WebDAV/Logout';
        editor.getActionsManager().registerAction(logoutActionId, logoutAction);
        var toolbar = e.actionsConfiguration.toolbars[0];

        var moreMenu = toolbar.children[toolbar.children.length - 1];
        moreMenu.children.push(
          {id: logoutActionId, type: "action"}
        );
      });


      // Listen for messages sent from the server-side code.
      goog.events.listen(editor, sync.api.Editor.EventTypes.CUSTOM_MESSAGE_RECEIVED, function(e) {
        var context = e.context;
        var url = e.message.message;

        // pop-up an authentication window,
        login(url, function() {
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

  /**
   * The Log out action for WebDAV
   *
   * @constructor
   */
  function LogOutAction (editor) {
    this.editor = editor;
  }
  goog.inherits(LogOutAction, sync.actions.AbstractAction);

  /**
   * Constructs and returns the log-out confirmation dialog.
   *
   * @return {sync.api.Dialog} The dialog used to confirm teh log-out action.
   */
  LogOutAction.prototype.getDialog = function() {
    if (!this.dialog) {
      this.dialog = workspace.createDialog();
      this.dialog.setTitle('Log out');
      this.dialog.setButtonConfiguration([{key: 'yes', caption: 'Logout'}, {key: 'no', caption: 'Cancel'}]);

      var dialogHtml = '<div><div>';
      dialogHtml += 'Are you sure you want to log-out? ';
      if (this.editor && this.editor.isDirty()) {
        dialogHtml += '<b>All your unsaved changes will be lost</b>'
      }
      dialogHtml += '</div></div>';

      this.dialog.getElement().innerHTML = dialogHtml;
    }
    return this.dialog;
  };

  /**
   * Called when the Logout button is clicked
   *
   * @override
   */
  LogOutAction.prototype.actionPerformed = function() {
    this.dialog = this.getDialog();
    this.dialog.onSelect(goog.bind(function (actionName, e) {
      if (actionName == 'yes') {
        e.preventDefault();
        goog.net.XhrIo.send(
          '../plugins-dispatcher/login?action=logout',
          goog.bind(function () {
            // hide the dialog once we logged out.
            this.dialog.hide();
            fileBrowser.candidateUrl = null;
            fileBrowser.switchToRepoConfig();
            fileBrowser.dialog.hide();

            localStorage.removeItem('webdav.latestUrl');
            localStorage.removeItem('webdav.latestRootUrl');
            localStorage.removeItem('webdav.user');
            // if we are editing we go to dashboard.
            if(sync.util.getURLParameter('url')) {
              this.editor && this.editor.setDirty(false);
              sync.util.setUrlParameter('url');
              window.location.reload();
            }
          }, this),
          'POST');
      }
    }, this));
    this.dialog.setPreferredSize(320, 185);
    this.dialog.show();
  };

  /** @override */
  LogOutAction.prototype.getDisplayName = function() {
    return "Logout";
  };

  /**
   * Webdav url chooser.
   *
   * @constructor
   */
  var WebdavFileBrowser = function() {
    var latestUrl = this.getLatestUrl();
    var latestRootUrl = this.getLatestRootUrl();
    sync.api.FileBrowsingDialog.call(this, {
      initialUrl: latestUrl,
      root: latestRootUrl
    });
    // enforced servers array.
    this.enforcedServers = [];
    var enforcedServer = sync.options.PluginsOptions.getClientOption('enforced_webdav_server');
    if(enforcedServer) {
      this.addEnforcedUrl(enforcedServer);
    }
    /** Declare a global method to register an enforced URL */
    window.addEnforcedWebdavUrl = goog.bind(this.addEnforcedUrl, this);

    //  Wait for other plugins javscript to run and set variabled.
    setTimeout(goog.bind(function(){
      // whether the webdav server plugin is installed.
      this.isServerPluginInstalled = false;
      if(typeof webdavServerPluginUrl !== 'undefined' && webdavServerPluginUrl) {
        this.isServerPluginInstalled = true;
      }
      if(this.enforcedServers.length > 0) {
        this.enforcedUrl = null;
        var initialUrl = localStorage.getItem('webdav.latestUrl');
        var i = 0;
        // try to determine the initial enforced url.
        for(i = 0; i < this.enforcedServers.length; i++) {
          if (initialUrl && initialUrl.indexOf(this.enforcedServers[i]) == 0) {
            this.enforcedUrl = this.enforcedServers[i];
            break;
          }
        }
        // no default was determined and we have only one enforcedUrl
        if(!this.enforcedUrl && this.enforcedServers.length == 1) {
          this.enforcedUrl = this.enforcedServers[0];
          initialUrl = this.enforcedUrl;
        }
        // enforce detected URL.
        if(this.enforcedUrl) {
          this.setRootUrl(this.enforcedUrl);
          this.setInitialUrl_(initialUrl);
          this.candidateUrl = initialUrl;
          localStorage.setItem('webdav.latestRootUrl', this.enforcedUrl);
          localStorage.setItem('webdav.latestUrl', initialUrl);
        }
      }
    }, this), 0);
  };
  goog.inherits(WebdavFileBrowser, sync.api.FileBrowsingDialog);

  /**
   * Processes and adds the url to the enforced servers list.
   *
   * @param url the url to enforce.
   */
  WebdavFileBrowser.prototype.addEnforcedUrl = function(url) {
    if(url) {
      this.enforcedServers.push(this.processURL(url));
    }
  };

  /** @override */
  WebdavFileBrowser.prototype.renderRepoPreview = function(element) {
    this.renderTitleBarLogoutButton(element);

    var url = this.getCurrentFolderUrl();
    if (url) {
      element.style.paddingLeft = '5px';
      element.title = "Server URL";
      var content = '<div class="webdav-repo-preview">' +
        '<div class="domain-icon" style="' +
        'background-image: url(' + sync.util.getImageUrl('/images/SharePointWeb16.png', sync.util.getHdpiFactor()) +
        ');vertical-align: middle"></div>' +
        new sync.util.Url(url).getDomain();
      // add an edit button only of there are no enforced servers
      // or there are more than one enforced server.
      if(this.enforcedServers.length != 1) {
        content += '<div class="webdav-domain-edit"></div>';
      }
      content += '</div>'
      element.innerHTML = content;
      var button = element.querySelector('.webdav-domain-edit');
      if(button) {
        button.title = "Edit server URL";
        goog.events.listen(button, goog.events.EventType.CLICK,
          goog.bind(this.switchToRepoConfig, this, element))
      }
    }
    this.dialog.setPreferredSize(null, 700);
  };

  /** @override */
  WebdavFileBrowser.prototype.renderRepoEditing = function(element) {
    if(this.enforcedServers.length > 0) {
      var dialogContent = '<div class="enforced-servers-config">' +
        'Server URL: <select id="webdav-browse-url">';
      var i;
      for(i = 0; i < this.enforcedServers.length; i++) {
        var serverUrl = this.enforcedServers[i];
        if(serverUrl) {
          dialogContent += '<option value="' + serverUrl + '" '
          dialogContent += (serverUrl == localStorage.getItem('webdav.latestEnforcedURL') ? 'selected' : '') + '>';
          dialogContent += serverUrl;
          dialogContent += '</option>';
        }
      }
      dialogContent += '</select></div>';
      element.innerHTML = dialogContent;
    } else {
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
      if (this.isServerPluginInstalled) {
        wevdavServerPluginContent =
          '<div class="webdav-builtin-server">' +
          '<div class="webdav-use-builtin-btn">Use built-in server</div>' +
          '<input readonly class="webdav-builtin-url" value="' + webdavServerPluginUrl + '">' +
          '</div>';
      }
      element.innerHTML =
        '<div class="webdav-config-dialog">' +
        '<label>Server URL: <input id="webdav-browse-url" type="text" autocorrect="off" autocapitalize="none" autofocus/></label>' +
        wevdavServerPluginContent +
        '</div>';
      element.querySelector('#webdav-browse-url').value = editUrl;

      // handle click on the Use builtin server button.
      if (this.isServerPluginInstalled) {
        var useBuiltinServerBtn = element.querySelector('.webdav-builtin-server .webdav-use-builtin-btn');
        goog.events.listen(useBuiltinServerBtn, goog.events.EventType.CLICK,
          goog.bind(function() {
            var processedUrl = this.processURL(webdavServerPluginUrl);
            var urlInfo = {
              type: 'FOLDER',
              rootUrl: processedUrl
            };
            this.openUrlInfo(processedUrl, urlInfo);
          }, this));
      }
    }
    var prefferedHeight = this.isServerPluginInstalled && this.enforcedServers.length == 0 ? 230 : 190;
    this.dialog.setPreferredSize(null, prefferedHeight);
  };

  /** @override */
  WebdavFileBrowser.prototype.handleOpenRepo = function(element, e) {
    var url = document.getElementById('webdav-browse-url').value.trim();

    // if an url was provided we instantiate the file browsing dialog.
    if(url) {
      if(this.enforcedServers.length > 0) {
        this.enforcedUrl = url;
        this.openUrlInfo(url, {rootUrl: url});
        localStorage.setItem('webdav.latestEnforcedURL', this.enforcedUrl);
      } else {
        var processedUrl = this.processURL(url);
        this.requestUrlInfo_(processedUrl);
      }
    }
    e.preventDefault();
  };

  /**
   * Renders the logout button on the dialog title bar.
   *
   * @param dialogChild a child of the dialog element from which
   * we can start the search for the title bar.
   */
  WebdavFileBrowser.prototype.renderTitleBarLogoutButton = function(dialogChild) {
    if(!this.renderedLogoutButton  && !sync.util.getURLParameter('url')) {
      var dialogTitleBar = (new goog.dom.DomHelper())
        .getAncestorByClass(dialogChild, 'modal-dialog');

      var logoutContainer = document.createElement('div');
      goog.dom.classlist.add(logoutContainer, 'webdav-logout-container');
      logoutContainer.innerHTML = 'Logout';
      dialogTitleBar.appendChild(logoutContainer);

      goog.events.listen(logoutContainer,
        goog.events.EventType.CLICK,
        function() {
          (new LogOutAction()).actionPerformed();
        },
        false,
        this)
      // mark that the button has been rendered
      this.renderedLogoutButton = true;
    }
  };

  /**
   * Request the URL info from the server.
   *
   * @param {string} url The URL about which we ask for information.
   * @param {function} opt_callback callback method to replace the openUrlInfo method.
   *
   * @private
   */
  WebdavFileBrowser.prototype.requestUrlInfo_ = function (url, opt_callback) {
    var callback = opt_callback || goog.bind(this.openUrlInfo, this);
    goog.net.XhrIo.send(
      '../plugins-dispatcher/webdav-url-info?url=' + encodeURIComponent(url),
      goog.bind(this.handleUrlInfoReceived, this, url, callback));
  };

  /**
   * URL information received from the server, we can open that URL in the dialog.
   *
   * @param {string} url The URL about which we requested info.
   * @param {function} callback the callback method.
   *
   * @param {goog.events.Event} e The XHR event.
   */
  WebdavFileBrowser.prototype.handleUrlInfoReceived = function (url, callback, e) {
    var request = /** {@type goog.net.XhrIo} */ (e.target);
    var status = request.getStatus();
    if (status == 200) {
      var info = request.getResponseJson();
      callback(url, info);
    } else if (status == 401) {
      login(url, goog.bind(this.requestUrlInfo_, this, url, callback));
    } else {
      this.showErrorMessage('Cannot open this URL');
    }
  };


  /**
   * Opens the url and sets it's url info.
   *
   * @param url the url to open.
   * @param info the available url information.
   *
   */
  WebdavFileBrowser.prototype.openUrlInfo = function(url, info) {
    var isFile = info.type === 'FILE';
    // Make sure folder urls end with '/'.
    if (!isFile && url.lastIndexOf('/') !== url.length - 1) {
      url = url + '/';
    }

    this.setUrlInfo(url, info);
    this.openUrl(url, isFile, null);
  }

  /**
   * Sets the information received about the url.
   *
   * @param url the url whose info to set.
   * @param info the available url information.
   *
   */
  WebdavFileBrowser.prototype.setUrlInfo = function(url, info) {
    var rootUrl = this.processURL(info.rootUrl);
    var urlObj = new sync.util.Url(url);
    localStorage.setItem('webdav.latestUrl', urlObj.getFolderUrl());
    localStorage.setItem('webdav.latestRootUrl', rootUrl);
    this.setRootUrl(rootUrl);
    this.setInitialUrl_(url);
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
    var lastRootUrl = this.enforcedUrl || localStorage.getItem('webdav.latestRootUrl');
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
      function (e) {
        var url = e.message.message;
        login(url, function() {
          fileBrowser.refresh();
        });
      });
  };

  // create the connection configurator.
  var fileBrowser = new WebdavFileBrowser();

  // register all the listeners on the file browser.
  registerFileBrowserListeners(fileBrowser);
  goog.events.listen(workspace, sync.api.Workspace.EventType.EDITOR_LOADED, function(e) {
    var currDocUrl = e.editor.getUrl();

    // if the current root and url are not set we use the current document url.
    if (currDocUrl && currDocUrl.match(/^webdav-https?:/)) {
      var lastRootUrl = localStorage.getItem('webdav.latestRootUrl');
      // If the latest root url is not a parent of the current document url, we need to compute the root url.
      if (!lastRootUrl || currDocUrl.indexOf(lastRootUrl) === -1) {
        fileBrowser.requestUrlInfo_(currDocUrl,
          goog.bind(fileBrowser.setUrlInfo, fileBrowser));
      }
    }
  });

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
