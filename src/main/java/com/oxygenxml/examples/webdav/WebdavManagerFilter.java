package com.oxygenxml.examples.webdav;


import java.io.IOException;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;

/**
 * Class responsible with determining the context of an URL connection, i.e.
 * which is the user on behalf of which we are making the request.
 */
public class WebdavManagerFilter implements Filter {
  /**
   * Credentials of the user on behalf of which the current request is executed.
   */
  private static ThreadLocal<UserCredentials> currentUserData = 
      new ThreadLocal<UserCredentials>();

  /**
   * Cache of user credentials.
   */
  private static Cache<String, UserCredentials> userDataCache = 
      CacheBuilder.newBuilder().build();
  

  /**
   * Returns the user data for a given user. If the function executes
   * during a user request, we check that the user making the request is the
   * same as the user for which we try to get the data.
   * 
   * @param userId The id of the user in whose data we are interested.
   * 
   * @return The user data.
   */
  static UserCredentials getUserData(String userId) {
    UserCredentials cachedUserData = getUserDataUnauthenticated(userId);
    UserCredentials userData = currentUserData.get();
    if (userData != null && userData != cachedUserData) {
      // The current user trying to access the file is not the same as the user 
      // that the file belongs to.
      cachedUserData = null;
    }
    return cachedUserData;
  }

  /**
   * Returns the user data for the given user Id. It does not check it against
   * the current user.
   * 
   * @param userId The id of the user.
   * 
   * @return The user data.
   */
  private static UserCredentials getUserDataUnauthenticated(String userId) {
    try {
      return userDataCache.get(userId, new Callable<UserCredentials>() {
        @Override
        public UserCredentials call() throws Exception {
          return new UserCredentials();
        }
      });
    } catch (ExecutionException e) {
      // Cannot happen.
      return null;
    }
  }
  
  /**
   * Default constructor. 
   */
  public WebdavManagerFilter() {
  }

	/**
	 * @see Filter#destroy()
	 */
	public void destroy() {
	}

	/**
	 * @see Filter#doFilter(ServletRequest, ServletResponse, FilterChain)
	 */
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
	  // Determine the current user data and link it to the current thread.
	  HttpServletRequest httpRequest = (HttpServletRequest) request;
	  String userId = (String) httpRequest.getSession().getId();
	  UserCredentials userData = userDataCache.getIfPresent(userId);
	  
    currentUserData.set(userData);
    try {
      chain.doFilter(request, response);
    } finally {
      currentUserData.remove();
    }
	}

	/**
	 * @see Filter#init(FilterConfig)
	 */
	public void init(FilterConfig fConfig) throws ServletException {
	}
}
