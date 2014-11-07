Browse and Auth pages
=====================

In order to customize the user interface of the oXygen XML Author WebApp integration with an WebDAV-enabled server, you can change the following HTML files:

The Browse page
---------------

The browse page, [browse.html](https://github.com/oxygenxml/webapp-webdav-integration/blob/master/src/main/webapp/webdav/browse.html),  has as its only goal to redirect the user to the dispatching page with the URL of the file to be edited as a parameter. It can be completely redesigned, moved to another location or simply replaced with an entry in the context menu of the CMS browsing view.

The URL it needs to redirect to is `/webapp-webdav-integration/webdav/start?url=FILE_URL` where `FILE_URL` is the [percent-encoded](http://en.wikipedia.org/wiki/Percent-encoding) URL of the file.

The Authentication page
-----------------------

The authentication page, [auth.html](https://github.com/oxygenxml/webapp-webdav-integration/blob/master/src/main/webapp/webdav/browse.html), can also be redesigned or replaced. It's role is to send the user name and password to the server using POST request. 

Since the webapp needs to redirect the user to this page if the credentials need to be entered, its location can be changed only if it is also changed in the code in [EntryPoint.java](https://github.com/oxygenxml/webapp-webdav-integration/blob/master/src/main/java/com/oxygenxml/examples/webdav/EntryPoint.java#L52).

The page receives an URL parameter called `url` which is the URL the user needs to authenticate for. And it needs to make a POST request to the following URL:

`/webapp-webdav-integration/webdav/start`

with the parameters:

 - `user` : the user name
 - `passwd` : the password
 - `url` : the URL received as a parameter.