use axum::{
    body::Body,
    http::{HeaderMap, Method, Uri},
    response::Response,
};
use http_body_util::BodyExt;
use hyper_util::{
    client::legacy::{connect::HttpConnector, Client},
    rt::TokioExecutor,
};
use tracing::info;

use crate::registry::Website;

type HyperClient = Client<HttpConnector, Body>;

pub async fn proxy_request(
    website: Website,
    path: &str,
    method: Method,
    headers: HeaderMap,
    uri: Uri,
    body: Body,
) -> Result<Response, crate::AppError> {
    // Build target URL
    let base_url = website.target_url.trim_end_matches('/');
    let path = path.trim_start_matches('/');
    let query = uri.query().map(|q| format!("?{}", q)).unwrap_or_default();
    let target_url = format!("{}/{}{}", base_url, path, query);

    info!(
        "Proxying {} {} -> {}",
        method,
        uri.path(),
        target_url
    );

    // Parse target URL
    let target_uri: Uri = target_url
        .parse()
        .map_err(|e| crate::AppError::ProxyError(format!("Invalid target URL: {}", e)))?;

    // Create client
    let client: HyperClient = Client::builder(TokioExecutor::new()).build_http();

    // Build request
    let mut req_builder = hyper::Request::builder()
        .method(method.clone())
        .uri(target_uri);

    // Copy relevant headers
    let headers_to_forward = [
        "accept",
        "accept-encoding",
        "accept-language",
        "content-type",
        "user-agent",
        "authorization",
        "cookie",
    ];

    for header_name in headers_to_forward {
        if let Some(value) = headers.get(header_name) {
            req_builder = req_builder.header(header_name, value);
        }
    }

    let req = req_builder
        .body(body)
        .map_err(|e| crate::AppError::ProxyError(format!("Failed to build request: {}", e)))?;

    // Send request
    let response = client
        .request(req)
        .await
        .map_err(|e| crate::AppError::ProxyError(format!("Request failed: {}", e)))?;

    // Convert response
    let (parts, incoming_body) = response.into_parts();

    // Collect the body
    let body_bytes = incoming_body
        .collect()
        .await
        .map_err(|e| crate::AppError::ProxyError(format!("Failed to read response body: {}", e)))?
        .to_bytes();

    // Build response
    let mut response_builder = Response::builder().status(parts.status);

    // Copy response headers
    let headers_to_copy = [
        "content-type",
        "content-encoding",
        "cache-control",
        "etag",
        "last-modified",
        "set-cookie",
    ];

    for header_name in headers_to_copy {
        if let Some(value) = parts.headers.get(header_name) {
            response_builder = response_builder.header(header_name, value);
        }
    }

    let response = response_builder
        .body(Body::from(body_bytes))
        .map_err(|e| crate::AppError::ProxyError(format!("Failed to build response: {}", e)))?;

    Ok(response)
}
