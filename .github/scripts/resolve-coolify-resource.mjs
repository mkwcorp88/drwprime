import { readFileSync } from "node:fs";

const [resourceType, targetDomain] = process.argv.slice(2);
const resources = JSON.parse(readFileSync(0, "utf8"));

if (!Array.isArray(resources) || !targetDomain) {
  process.exit(1);
}

const normalizedDomain = targetDomain.toLowerCase();
const normalizedName = normalizedDomain.split(".")[0].replace(/[^a-z0-9]/g, "");
const matchesName = (resource) =>
  String(resource.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") === normalizedName;
const matchesDomain = (resource) =>
  String(resource.fqdn || "")
    .split(",")
    .some((value) => {
      const domain = value.trim();
      try {
        return new URL(domain).hostname.toLowerCase() === normalizedDomain;
      } catch {
        return domain.toLowerCase() === normalizedDomain;
      }
    });
const matchesServiceConfig = (resource) =>
  [
    resource.description,
    resource.docker_compose_raw,
    resource.docker_compose,
  ].some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(normalizedDomain),
  ) ||
  [resource.docker_compose_raw, resource.docker_compose].some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(normalizedName),
  );

const resource =
  resourceType === "application"
    ? resources.find(matchesDomain) || resources.find(matchesName)
    : resources.find(matchesName) || resources.find(matchesServiceConfig);

if (resource?.uuid) {
  process.stdout.write(resource.uuid);
}
