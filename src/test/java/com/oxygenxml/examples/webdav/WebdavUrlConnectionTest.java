package com.oxygenxml.examples.webdav;

import java.io.OutputStream;
import java.net.PasswordAuthentication;
import java.net.URL;

import org.apache.commons.io.IOUtils;
import org.junit.Test;

public class WebdavUrlConnectionTest {

  @Test
  public void testCommit() throws Exception {
    System.setProperty("https.proxyHost", "10.0.0.18");
    System.setProperty("https.proxyPort", "3128");

    WebdavUrlStreamHandler.credentials.put("3", new PasswordAuthentication("ctalau-oxygen", "oxygen17".toCharArray()));

    URL fileUrl = new URL("https://github.com/ctalau-oxygen/flowers/trunk/ceva.dita");
    WebdavUrlConnection webdavConn = new WebdavUrlConnection("3", fileUrl.openConnection());

    OutputStream outputStream = webdavConn.getOutputStreamToSVNServer();
    try {
      IOUtils.write("<root/>", outputStream);
    } finally {
      outputStream.close();
    }
  }
}
