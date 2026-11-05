/** Configure the host-side client only; none of this environment is a container --env. */
export function containerClientConfiguration(executable) {
  const env = { ...process.env };
  if (process.env.CONTAINER_HOST !== undefined) {
    env.DOCKER_HOST = process.env.CONTAINER_HOST;
    delete env.DOCKER_CONTEXT;
  }
  return { executable: executable ?? process.env.CONTAINER_CLI ?? 'docker', env };
}
