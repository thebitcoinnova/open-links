import profile from "../../data/profile.json";
import links from "../../data/links.json";

export default function RouteIndex() {
  return (
    <main class="page">
      <section class="hero">
        <h1>{profile.name}</h1>
        <p>{profile.headline}</p>
        <p>{profile.bio}</p>
      </section>

      <section class="card-grid" aria-label="Links">
        {links.links
          .filter((link) => link.enabled !== false)
          .map((link) => (
            <a class="card" href={link.url} target="_blank" rel="noreferrer">
              <h2>{link.label}</h2>
              <p>{link.description ?? link.url}</p>
            </a>
          ))}
      </section>
    </main>
  );
}
