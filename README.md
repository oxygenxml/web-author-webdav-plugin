WebDAV Support for oXygen XML Web Author
========================================

This project is a very simple integration of oXygen XML Web Author with a WebDAV-enabled server, which can be extended with more features or can be adapted to work with any CMS.

Identifying the requesting user
----------------------

In order to implement a CMS connector, in oXygen one needs to implement a `URLStreamHandlerPluginExtension`, that returns an `URLStreamHandler` for the protocol used to communicate with the CMS.

In order to support authentication in the multi-user context of the oXygen XML Web Author, the `URLStreamHandler` instance should 
extend `URLStreamHandlerWithContext`. The difference from `URLStreamHandler` is that the `openConnectionInContext` method receives the session ID that uniquely identifies the user on behalf of which we are accessing the given URL. 

Credentials management
--------------------

When the user logs in, one needs to associate some credentials with the context ID.
 The simplest implementation would be to create a login servlet which implements the WebappServletPluginExtension interface and declare it as a WebappServlet extension in the plugin.xml file. The servlet would associate the user/passwd or the CMS session id with the context ID in a static Map.

Auth failure
-------------

If the `URLStreamHandler` fails to authenticate with the CMS, it should throw an UserActionRequiredException. This exception will carry a WebappMessage that will be sent to the client-side JavaScript code. 

The entire authentication failure handling should be implemented on the client-side. The basic steps are:
- listen for authentication failure messages
- pop-up an auth window
- send the updated credentials to the login servlet
- retry the user action

The implementation can be found in the `plugin.js` file from the `app/` folder in the webapp `.war`.

The URL that needs to be passed to the webapp is the WebDAV URL, prefixed with `webdav-` (e.g. `webdav-https://webdav-server.com/file.xml`).

Automatic save
----------------------

The **automatic save** capability can be configured from the administrator interface by setting an autosave interval greater than 0 (the initial value is 5 seconds). The interval represents the time between a change being made to the document and when the changes are automatically saved.
The autosave **visual feedback** depends on the autosave interval and has two feedback modes:
* **5 seconds or less** - The *Save* action is hidden and the autosave status is displayed in header to the right of the document name.
* **More than 5 seconds** - The *Save* action is available on the toolbar and when the autosave is triggered, a spinner is displayed over the toolbar button during the save process and the *Save* action button is disabled until more changes are made in the document.


Imposed URLs
-------------------
The **Imposed URLs** feature represents a list of **enforced URLs** that a user can browse. Once the connector has a list of imposed URLs, the user can only browse repositories from that list and the repo editing mode shows a non-editable drop-down list of the enforced urls for the user to choose from. If the imposed URLs list contains only one URL, the repository edit button is no longer displayed and that URL is automatically as the current repository.
The administrator can configure an **imposed URL** on the plugin's settings page and other plugins can contribute URLs to this list by calling the **addEnforcedWebdavUrl(enforcedURL)** global method that the *WebDAV Connector* exposes.

