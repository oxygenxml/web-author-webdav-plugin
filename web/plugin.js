(function() {
  var WEBDAV_LOGOUT_ACTION_ID = 'Webdav/Logout';

  /**
   * Login the user and call this callback at the end.
   *
   * @param {String} serverUrl the server that we are logging in url.
   * @param {function} authenticated The callback when the user was authenticated - successfully or not.
   */
  var loginDialog_ = null;
  function login(serverUrl, authenticated) {
    serverUrl = fileBrowser.processURL(serverUrl);

    var webdavNameInput,
      webdavPasswordInput;
    // pop-up an authentication window,
    if (!loginDialog_) {
      loginDialog_ = workspace.createDialog();

      var cD = goog.dom.createDom;

      webdavNameInput = cD('input', {id: 'webdav-name', type: 'text'});
      webdavNameInput.setAttribute('autocorrect', 'off');
      webdavNameInput.setAttribute('autocapitalize', 'none');
      webdavNameInput.setAttribute('autofocus', '');

      webdavPasswordInput = cD('input', {id: 'webdav-passwd', type: 'password'});

      goog.dom.appendChild(loginDialog_.getElement(),
        cD('div', 'webdav-login-dialog',
          cD('label', '',
            tr(msgs.NAME_) + ': ',
            webdavNameInput
          ),
          cD('label', '',
            tr(msgs.PASSWORD_)+ ': ',
            webdavPasswordInput
          )
        )
      );

      loginDialog_.setTitle(tr(msgs.AUTHENTICATION_REQUIRED_));
      loginDialog_.setPreferredSize(300, null);
    }
    loginDialog_.onSelect(function(key) {
      if (key === 'ok') {
        // Send the user and password to the login servlet which runs in the webapp.
        var userField = webdavNameInput || document.getElementById('webdav-name');
        var user = userField.value.trim();
        var passwdField = webdavPasswordInput || document.getElementById('webdav-passwd');
        var passwd = passwdField.value;

        userField.value = '';
        passwdField.value = '';

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

    loginDialog_.show();
    var lastUser = localStorage.getItem('webdav.user');
    if(lastUser) {
      var userInput = webdavNameInput || loginDialog_.getElement().querySelector('#webdav-name');
      userInput.value = lastUser;
      userInput.select();
    }
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
        this.logoutAction = new LogOutAction(editor);
        editor.getActionsManager().registerAction(WEBDAV_LOGOUT_ACTION_ID, this.logoutAction);
        var toolbar = e.actionsConfiguration.toolbars[0];

        if(toolbar) {
          var moreMenu = toolbar.children[toolbar.children.length - 1];
          moreMenu.children.push(
            {id: WEBDAV_LOGOUT_ACTION_ID, type: "action"}
          );
        }
      });


      // Listen for messages sent from the server-side code.
      goog.events.listen(editor, sync.api.Editor.EventTypes.CUSTOM_MESSAGE_RECEIVED, function(e) {
        var context = e.context;
        var url = e.message.message;

        // pop-up an authentication window,
        login(url, function() {
          var webappMessageReceivedContext = sync.api.Editor.WebappMessageReceived.Context;
          // After the user was logged in, retry the operation that failed.
          if (context === webappMessageReceivedContext.LOAD) {
            // If the document was loading, we try to reload the whole webapp.
            window.location.reload();
          } else if (context === webappMessageReceivedContext.EDITING) {
            // During editing, only references can trigger re-authentication. Refresh them.
            editor.getActionsManager().invokeAction('Author/Refresh_references');
          } else if (context === webappMessageReceivedContext.SAVE) {
            // Currently there is no API to re-try saving, but it will be.
            editor.getActionsManager().getActionById('Author/Save').actionPerformed(function() {});
          } else if (context === webappMessageReceivedContext.IMAGE) {
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
    var dialog = this.dialog;
    if (!dialog) {
      dialog = workspace.createDialog();
      dialog.setTitle(tr(msgs.LOGOUT_));
      dialog.setButtonConfiguration([
        {key: 'yes', caption: tr(msgs.LOGOUT_)},
        {key: 'no', caption: tr(msgs.CANCEL_)}
      ]);

      var cD = goog.dom.createDom;

      var mightLoseChanges = (this.editor && this.editor.isDirty()) ?
        cD('b', '', tr(msgs.UNSAVED_CHANGES_WILL_BE_LOST_)) : null;

      goog.dom.appendChild(dialog.getElement(),
        cD('div', '',
          cD('div', '',
            tr(msgs.LOGOUT_CONFIRMATION_) + ' ',
            mightLoseChanges
          )
        )
      );

      this.dialog = dialog;
    }
    return dialog;
  };

  /**
   * Called when the Logout button is clicked
   *
   * @override
   */
  LogOutAction.prototype.actionPerformed = function() {
    this.dialog = this.getDialog();
    this.dialog.onSelect(goog.bind(function (actionName, e) {
      if (actionName === 'yes') {
        e.preventDefault();
        goog.net.XhrIo.send(
          '../plugins-dispatcher/login?action=logout',
          goog.bind(function () {
            // hide the dialog once we logged out.
            this.dialog.hide();

            localStorage.removeItem('webdav.latestUrl');
            localStorage.removeItem('webdav.latestRootUrl');
            localStorage.removeItem('webdav.user');

            // if we are editing we go to dashboard.
            if(sync.util.getURLParameter('url')) {
              this.editor && this.editor.setDirty(false);
              sync.util.setUrlParameter('url');
              window.location.reload();
            } else {
              // on dashboard, hide the dialogs.
              fileBrowser.dialog.hide();
              fileBrowser.clearFileBrowsingData();
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
    return tr(msgs.LOGOUT_);
  };

  /**
   * Webdav url chooser.
   *
   * @constructor
   */
  var WebdavFileBrowser = function() {
    goog.events.listenOnce(workspace, sync.api.Editor.EventTypes.BEFORE_EDITOR_LOADED, function(e) {
      this.editor = e.editor;
    }.bind(this));

    goog.events.listenOnce(workspace, sync.api.Workspace.EventType.BEFORE_DASHBOARD_LOADED, goog.bind(function (e) {
      this.logoutAction = new LogOutAction(null);
    }, this));

    var latestUrl = this.getLatestUrl();
    var latestRootUrl = this.getLatestRootUrl();

    var fileBrowserParams;
    if (!sync.util.getURLParameter('url')) { // If on dashboard.
      fileBrowserParams = {
        initialUrl: latestUrl,
        root: latestRootUrl
      };
    }
    sync.api.FileBrowsingDialog.call(this, fileBrowserParams);

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
      // webdavServerPluginUrl - may be set by another plugin.
      if (window.webdavServerPluginUrl) {
        this.isServerPluginInstalled = true;
      }
      if(this.enforcedServers.length > 0) {
        this.enforcedUrl = null;
        var initialUrl = localStorage.getItem('webdav.latestUrl');
        var i;
        // try to determine the initial enforced url.
        for(i = 0; i < this.enforcedServers.length; i++) {
          if (initialUrl && initialUrl.indexOf(this.enforcedServers[i]) === 0) {
            this.enforcedUrl = this.enforcedServers[i];
            break;
          }
        }
        // no default was determined and we have only one enforcedUrl
        if(!this.enforcedUrl && this.enforcedServers.length === 1) {
          this.enforcedUrl = this.enforcedServers[0];
          initialUrl = this.enforcedUrl;
        }
        // enforce detected URL.
        if(this.enforcedUrl) {
          this.setRootUrl(this.enforcedUrl);
          this.setUpTheDialog(initialUrl);
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
    this.showTitleBarLogoutButton(element);

    var url = this.getCurrentFolderUrl();
    if (url) {
      element.style.paddingLeft = '5px';
      element.title = tr(msgs.SERVER_URL_);

      var cD = goog.dom.createDom;
      var bgImageUrl = sync.util.getImageUrl('/images/SharePointWeb16.png', sync.util.getHdpiFactor());

      // add an edit button only of there are no enforced servers
      // or there are more than one enforced server.
      var button = null;
      if (this.enforcedServers.length !== 1) {
        button = cD('div', {
          className: 'webdav-domain-edit',
          title: tr(msgs.EDIT_SERVER_URL_)
        });
      }

      element.innerHTML = '';
      goog.dom.appendChild(element,
        cD('div', 'webdav-repo-preview',
          cD('div', {
            className: 'domain-icon',
            style: 'background-image: url(' + bgImageUrl + ');vertical-align: middle;'
          }),
          new sync.util.Url(url).getDomain(),
          button
        ));

      if(button) {
        goog.events.listen(button, goog.events.EventType.CLICK,
          goog.bind(this.switchToRepoConfig, this, element))
      }
    }
    this.dialog.setPreferredSize(null, 700);
  };

  /** @override */
  WebdavFileBrowser.prototype.renderRepoEditing = function(element) {
    // hide the logout button.
    this.hideTitleBarLogoutButton(element);

    var cD = goog.dom.createDom;
    var enforcedServersLength = this.enforcedServers.length;
    if(enforcedServersLength > 0) {
      var options = [];
      for(var i = 0; i < enforcedServersLength; i++) {
        var serverUrl = this.enforcedServers[i];
        if(serverUrl) {
          var option = cD('option', {value: serverUrl}, serverUrl);
          if (serverUrl === localStorage.getItem('webdav.latestEnforcedURL')) {
            option.setAttribute('selected', '');
          }
          options.push(option);
        }
      }

      goog.dom.removeChildren(element);
      goog.dom.appendChild(element,
        cD('div', 'enforced-servers-config',
          tr(msgs.SERVER_URL_) + ': ',
          cD('select', {id: 'webdav-browse-url'}, options)
        )
      );
    } else {
      var url = this.getCurrentFolderUrl();
      var latestUrl = this.getLatestUrl();
      // if none was set we let it empty.
      var editUrl = latestUrl || url || '';
      if (editUrl && (editUrl.indexOf('webdav-') === 0)) {
        editUrl = editUrl.substring(7);
      }
      var button = element.querySelector('.webdav-domain-edit');
      element.title = "";
      goog.events.removeAll(button);

      element.style.paddingLeft = '5px';
      // the webdavServerPlugin additional content.
      var webdavServerPluginContent;
      var useBuiltinServerBtn;

      // if the webdav-server-plugin is installed display a button to use it.
      if (this.isServerPluginInstalled) {
        var readOnlyInput = cD('input', {className: 'webdav-builtin-url', value: window.webdavServerPluginUrl});
        readOnlyInput.setAttribute('readonly', '');

        useBuiltinServerBtn = cD('div', 'webdav-use-builtin-btn', tr(msgs.USE_BUILTIN_SERVER_));

        webdavServerPluginContent = cD('div', 'webdav-builtin-server',
          useBuiltinServerBtn,
          readOnlyInput
        );
      }

      var webdavBrowseUrlInput = cD('input', {id: 'webdav-browse-url', type: 'text'});
      webdavBrowseUrlInput.setAttribute('autocorrect', 'off');
      webdavBrowseUrlInput.setAttribute('autocapitalize', 'none');
      webdavBrowseUrlInput.setAttribute('autofocus', '');

      element.innerHTML = '';
      goog.dom.appendChild(element,
        cD('div', 'webdav-config-dialog',
          cD('label', '',
            tr(msgs.SERVER_URL_) + ': ',
            webdavBrowseUrlInput
          ),
          webdavServerPluginContent
        )
      );
      element.querySelector('#webdav-browse-url').value = editUrl;

      // handle click on the Use builtin server button.
      if (this.isServerPluginInstalled) {
        goog.events.listen(useBuiltinServerBtn, goog.events.EventType.CLICK,
          goog.bind(function() {
            var processedUrl = this.processURL(window.webdavServerPluginUrl);
            var urlInfo = {
              type: 'FOLDER',
              rootUrl: processedUrl
            };
            this.openUrlInfo(processedUrl, urlInfo);
          }, this));
      }
    }
    var prefferedHeight = this.isServerPluginInstalled && enforcedServersLength === 0 ? 230 : 190;
    this.dialog.setPreferredSize(null, prefferedHeight);
  };

  /** @override */
  WebdavFileBrowser.prototype.handleOpenRepo = function(element, e) {
    var input = document.getElementById('webdav-browse-url');
    var url = input.value.trim();

    // if an url was provided we instantiate the file browsing dialog.
    if(url) {
      if(url.match('(webdav-)?https?:\/\/')) {
        if (this.enforcedServers.length > 0) {
          this.enforcedUrl = url;
          this.openUrlInfo(url, {rootUrl: url});
          localStorage.setItem('webdav.latestEnforcedURL', this.enforcedUrl);
        } else {
          var processedUrl = this.processURL(url);
          this.requestUrlInfo_(processedUrl, goog.bind(this.openUrlInfo, this));
        }
      } else {
        this.showErrorMessage(tr(msgs.INVALID_URL_));
        // hide the error element on input refocus.
        goog.events.listenOnce(input, goog.events.EventType.FOCUS,
          goog.bind(function(e) {this.hideErrorElement();}, this));
      }
    }
    e.preventDefault();
  };

  /**
   * Shows the logout button on the dialog title bar.
   *
   * @param dialogChild a child of the dialog element from which
   * we can start the search for the title bar.
   */
  WebdavFileBrowser.prototype.showTitleBarLogoutButton = function(dialogChild) {
    var dialogTitleBar = (new goog.dom.DomHelper())
      .getAncestorByClass(dialogChild, 'modal-dialog');

    if(!this.renderedLogoutButton  && !sync.util.getURLParameter('url')) {
      var logoutContainer = goog.dom.createDom('div', 'webdav-logout-container', tr(msgs.LOGOUT_));
      dialogTitleBar.appendChild(logoutContainer);

      goog.events.listen(logoutContainer,
        goog.events.EventType.CLICK, function() {
          this.logoutAction.actionPerformed();
        }.bind(this),
        false,
        this);
      // mark that the button has been rendered
      this.renderedLogoutButton = true;
    }

    goog.dom.classlist.remove(dialogTitleBar, 'webdav-hide-logout');
  };

  /**
   * Hides the logout button on the dialog title bar.
   *
   * @param dialogChild a child of the dialog element from which
   * we can start the search for the title bar.
   */
  WebdavFileBrowser.prototype.hideTitleBarLogoutButton = function(dialogChild) {
    var dialogTitleBar = (new goog.dom.DomHelper())
      .getAncestorByClass(dialogChild, 'modal-dialog');

    goog.dom.classlist.add(dialogTitleBar, 'webdav-hide-logout');
  };


  /**
   * Request the URL info from the server.
   *
   * @param {string} url The URL about which we ask for information.
   * @param {function} callback The callback function.
   *
   * @private
   */
  WebdavFileBrowser.prototype.requestUrlInfo_ = function (url, callback) {
    console.log('Old method called ', url);
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
      this.showErrorMessage(tr(msgs.CANNOT_OPEN_URL_));
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
  };

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
    this.setUpTheDialog(url);
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
    if((url.indexOf('webdav-') !== 0)) {
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
      lastRootUrl = window.webdavServerPluginUrl;
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
      latestUrl = window.webdavServerPluginUrl;
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
  webdavOpenAction.setDescription(tr(msgs.OPEN_DOC_WEBDAV_DESCRIPTION_));
  webdavOpenAction.setActionId('webdav-open-action');
  webdavOpenAction.setActionName('WebDAV');

  var webdavCreateAction = new sync.api.CreateDocumentAction(fileBrowser);
  webdavCreateAction.setLargeIcon(iconUrl);
  webdavCreateAction.setDescription(tr(msgs.NEW_DOC_WEBDAV_DESCRIPTION_));
  webdavCreateAction.setActionId('webdav-create-action');
  webdavCreateAction.setActionName('WebDAV');

  var actionsManager = workspace.getActionsManager();
  actionsManager.registerOpenAction(webdavOpenAction);
  actionsManager.registerCreateAction(webdavCreateAction);

  sync.util.loadCSSFile("../plugin-resources/webdav/webdav.css");
})();
