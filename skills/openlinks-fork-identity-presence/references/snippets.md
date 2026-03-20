# Snippets

Replace placeholders with values resolved from the fork:

- `<openlinks-url>` from `data/site.json` `quality.seo.canonicalBaseUrl`
- `<display-label>` from site/profile display copy
- `<small-icon-url>` from `<openlinks-url>` plus `/favicon.svg`
- `<logo-url>` from `<openlinks-url>` plus `/branding/openlinks-logo/openlinks-logo.svg`

## HTML footer link

```html
<footer>
  <a href="<openlinks-url>" rel="noopener noreferrer">
    Find me on <display-label>
  </a>
</footer>
```

## HTML footer with icon

```html
<footer>
  <a href="<openlinks-url>" rel="noopener noreferrer" aria-label="Visit my OpenLinks page">
    <img src="<small-icon-url>" alt="<display-label> icon" width="18" height="18" />
    <span><display-label></span>
  </a>
</footer>
```

## README or docs section

```md
## Find Me

- [<display-label>](<openlinks-url>)
```

## Package-style metadata

```json
{
  "homepage": "<openlinks-url>",
  "author": {
    "name": "Your Name",
    "url": "<openlinks-url>"
  }
}
```

## Visible link with rel="me"

```html
<a href="<openlinks-url>" rel="me noopener noreferrer">
  <display-label>
</a>
```

## JSON-LD identity hint

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Your Name",
    "url": "<openlinks-url>",
    "sameAs": ["<openlinks-url>"]
  }
</script>
```
