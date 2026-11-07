function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Serve directory indexes from S3 (needed for sibling apps and Next trailingSlash routes).
  if (uri.endsWith("/")) {
    request.uri = uri + "index.html";
  } else if (!uri.includes(".")) {
    request.uri = uri + "/index.html";
  }

  return request;
}
