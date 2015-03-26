goog.events.listen(workspace, sync.api.Workspace.EventType.BEFORE_EDITOR_LOADED, function(e) {
  // The editor is about to be loaded.
  var editor = e.editor;

  // Listen for messages sent from the server-side code.
  goog.events.listen(editor, sync.api.Editor.EventTypes.CUSTOM_MESSAGE_RECEIVED, function(e) {
    var context = e.context;

    // pop-up an authentication window,
    var dialog1 = workspace.createDialog();
    dialog1.getElement().innerHTML =
        '<label>Name: <input id="webdav-name" type="text"/></label>' +
        '<label>Password: <input id="webdav-passwd" type="password"/></label>';
    dialog1.setTitle('Authentication Required');
    dialog1.show();

    dialog1.onSelect(function(key) {
      if (key == 'ok') {
        // Send the user and password to the login servlet which runs in the webapp.
        var user = document.getElementById('webdav-name').value;
        var passwd = document.getElementById('webdav-passwd').value;
        var request = new goog.net.XhrIo();
        request.send('../login?user=' + encodeURIComponent(user) + "&passwd=" + encodeURIComponent(passwd), 'POST');

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
});

