import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from 'react-router-dom';
import "./style/home.css";
import loaderGif from "../public/assets/loader.gif";
import axios from "axios";
import urlJoin from "url-join";

const EXAMPLE_MAIN_URL = window.location.origin;

export const Home = () => {
  const [pageLoading, setPageLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [storedUrl, setStoredUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [proxyExists, setProxyExists] = useState(false);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyMessage, setProxyMessage] = useState('');
  const [proxyInfo, setProxyInfo] = useState(null);
  const { application_id, company_id } = useParams();
  const [searchParams] = useSearchParams();
  const redirectMessage = searchParams.get('redirect_message');
  
  useEffect(() => {
    if (isApplicationLaunch()) {
      fetchStoredUrl();
      fetchProxyStatus();
    }
  }, [application_id]);

  const fetchStoredUrl = async () => {
    if (!isApplicationLaunch()) return; // Only fetch if at sales channel level
    
    try {
      const { data } = await axios.get(urlJoin(EXAMPLE_MAIN_URL, `/api/url/application/${application_id}`), {
        headers: {
          "x-company-id": company_id,
        }
      });
      setStoredUrl(data.url);
      setUrlInput(data.url);
    } catch (e) {
      console.error("Error fetching stored URL:", e);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    setUrlLoading(true);
    setMessage('');

    try {
      const { data } = await axios.post(
        urlJoin(EXAMPLE_MAIN_URL, `/api/url/application/${application_id}`),
        { url: urlInput },
        {
          headers: {
            "x-company-id": company_id,
            "Content-Type": "application/json",
          }
        }
      );
      
      setStoredUrl(data.url);
      setMessage('URL updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      console.error("Error updating URL:", e);
      setMessage(e.response?.data?.error || 'Error updating URL');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUrlLoading(false);
    }
  };

  const handleUrlInputChange = (e) => {
    setUrlInput(e.target.value);
  };

  const fetchProxyStatus = async () => {
    if (!isApplicationLaunch()) return;
    
    try {
      const { data } = await axios.get(urlJoin(EXAMPLE_MAIN_URL, `/api/proxy/application/${application_id}`), {
        headers: {
          "x-company-id": company_id,
        }
      });
      setProxyExists(data.exists);
      setProxyInfo(data.proxy);
    } catch (e) {
      console.error("Error fetching proxy status:", e);
    }
  };

  const handleCreateProxy = async () => {
    setProxyLoading(true);
    setProxyMessage('');

    try {
      const { data } = await axios.post(
        urlJoin(EXAMPLE_MAIN_URL, `/api/proxy/application/${application_id}?company_id=${company_id}`),
        {},
        {
          headers: {
            "x-company-id": company_id,
            "Content-Type": "application/json",
          }
        }
      );
      
      setProxyExists(true);
      setProxyInfo(data.proxy);
      setProxyMessage('Proxy created successfully!');
      setTimeout(() => setProxyMessage(''), 3000);
    } catch (e) {
      console.error("Error creating proxy:", e);
      setProxyMessage(e.response?.data?.error || 'Error creating proxy');
      setTimeout(() => setProxyMessage(''), 3000);
    } finally {
      setProxyLoading(false);
    }
  };

  const handleRemoveProxy = async () => {
    setProxyLoading(true);
    setProxyMessage('');

    try {
      const { data } = await axios.delete(
        urlJoin(EXAMPLE_MAIN_URL, `/api/proxy/application/${application_id}?company_id=${company_id}`),
        {
          headers: {
            "x-company-id": company_id,
          }
        }
      );
      
      setProxyExists(false);
      setProxyInfo(null);
      setProxyMessage('Proxy removed successfully!');
      setTimeout(() => setProxyMessage(''), 3000);
    } catch (e) {
      console.error("Error removing proxy:", e);
      setProxyMessage(e.response?.data?.error || 'Error removing proxy');
      setTimeout(() => setProxyMessage(''), 3000);
    } finally {
      setProxyLoading(false);
    }
  };

  const isApplicationLaunch = () => !!application_id;

  return (
    <>
      {pageLoading ? (
        <div className="loader" data-testid="loader">
          <img src={loaderGif} alt="loader GIF" />
        </div>
      ) : (
        <>
          {isApplicationLaunch() ? (
            // Sales Channel Level - Show URL Manager
            <div className="url-manager-container">
              <div className="url-manager-header">
                <h2>URL Manager</h2>
                <p>Store and manage your global URL connection</p>
              </div>

              <div className="url-form-section">
                <form onSubmit={handleUrlSubmit} className="url-form">
                  <div className="input-group">
                    <label htmlFor="url-input">Enter URL:</label>
                    <input
                      id="url-input"
                      type="url"
                      value={urlInput}
                      onChange={handleUrlInputChange}
                      placeholder="https://example.com"
                      required
                      disabled={urlLoading}
                      className="url-input"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={urlLoading || !urlInput.trim()}
                    className="submit-button"
                  >
                    {urlLoading ? 'Updating...' : 'Update URL'}
                  </button>
                </form>

                {message && (
                  <div className={`message ${message.includes('Error') || message.includes('error') ? 'error' : 'success'}`}>
                    {message}
                  </div>
                )}
              </div>

              {storedUrl && (
                <div className="stored-url-section">
                  <h3>Current Stored URL:</h3>
                  <div className="stored-url-display">
                    <span className="url-text">{storedUrl}</span>
                    <a 
                      href={storedUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="visit-link"
                    >
                      Visit URL
                    </a>
                  </div>
                </div>
              )}

              {/* Proxy Management Section */}
              <div className="proxy-management-section">
                <div className="section-divider"></div>
                <h3>Proxy Management</h3>
                <p>Create a proxy URL to allow bindings to access the stored URL through Fynd Platform.</p>
                
                <div className="proxy-control">
                  {!proxyExists ? (
                    <button 
                      onClick={handleCreateProxy}
                      disabled={proxyLoading}
                      className="proxy-button create-proxy"
                    >
                      {proxyLoading ? 'Creating Proxy...' : '🔗 Create Proxy'}
                    </button>
                  ) : (
                    <div className="proxy-status">
                      <div className="proxy-info">
                        <span className="proxy-status-indicator">✅ Proxy Active</span>
                        {proxyInfo && (
                          <div className="proxy-details">
                            <p><strong>Endpoint:</strong> <code>{proxyInfo.proxy_endpoint || proxyInfo.attached_path}</code></p>
                            <p><strong>Created:</strong> {new Date(proxyInfo.created_at).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={handleRemoveProxy}
                        disabled={proxyLoading}
                        className="proxy-button remove-proxy"
                      >
                        {proxyLoading ? 'Removing...' : '🗑️ Remove Proxy'}
                      </button>
                    </div>
                  )}
                </div>

                {proxyMessage && (
                  <div className={`message ${proxyMessage.includes('Error') || proxyMessage.includes('error') ? 'error' : 'success'}`}>
                    {proxyMessage}
                  </div>
                )}

                <div className="proxy-info-box">
                  <h4>📋 About Proxy URLs</h4>
                  <p>
                    Proxy URLs allow your theme bindings to access the stored URL through the Fynd Platform. 
                    This bypasses CORS restrictions and enables seamless integration with your storefront.
                  </p>
                  <p>
                    <strong>URL Format:</strong> <code>{`{application_url}/ext/urlconnect`}</code>
                  </p>
                  <p>
                    <strong>Binding Usage:</strong> The proxy will automatically detect the application context and return the appropriate URL.
                  </p>
                </div>
              </div>
            </div>
                     ) : (
             // Company Level - Show redirect message
             <div className="company-level-container">
               <div className="company-level-header">
                 <h2>🚫 Access Restricted</h2>
                 <p>
                   {redirectMessage === 'sales_channel_required' 
                     ? 'You have been redirected because this extension requires Sales Channel access'
                     : 'This feature is only available at the Sales Channel level'
                   }
                 </p>
               </div>
               
               <div className="company-level-content">
                 <div className="info-box redirect-box">
                   <h3>🏪 Sales Channel Access Required</h3>
                                     <p>
                    The URLConnect extension is designed to work at the <strong>Sales Channel level</strong> only.
                    This manages a single global URL that can be accessed by all applications through the proxy.
                  </p>
                   
                   <div className="redirect-action">
                     <h4>🔄 How to access URL Manager:</h4>
                     <div className="action-steps">
                       <div className="step-box">
                         <span className="step-number">1</span>
                         <div className="step-content">
                           <strong>Go to Sales Channels</strong>
                           <p>Navigate to your Sales Channels section in the Fynd Platform</p>
                         </div>
                       </div>
                       
                       <div className="step-box">
                         <span className="step-number">2</span>
                         <div className="step-content">
                           <strong>Select a Sales Channel</strong>
                           <p>Choose the specific sales channel where you want to configure the URL</p>
                         </div>
                       </div>
                       
                       <div className="step-box">
                         <span className="step-number">3</span>
                         <div className="step-content">
                           <strong>Open URLConnect</strong>
                           <p>Launch the URLConnect extension from within that sales channel</p>
                         </div>
                       </div>
                     </div>
                   </div>
                   
                   <div className="help-note redirect-note">
                     <p>
                       <strong>💡 Why Sales Channel level?</strong> 
                       This ensures proper authentication and access control for the global URL configuration.
                     </p>
                   </div>
                 </div>
               </div>
             </div>
           )}
        </>
      )}
    </>
  );
};