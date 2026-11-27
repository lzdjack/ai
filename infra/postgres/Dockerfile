# PostgreSQL 16 + pg_bigm（中文全文检索，06 §1.3、§15 第 12 项）
FROM postgres:16.16-bookworm AS build
ARG PG_BIGM_VERSION=1.2-20250903
ARG PG_BIGM_SHA256=4d4fb48161e3f9e99207851299379c83b3e5d1d3c1a07c35f6a3153d577b3142
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential postgresql-server-dev-16 curl ca-certificates \
 && curl -fsSL -o /tmp/pg_bigm.tgz "https://github.com/pgbigm/pg_bigm/archive/refs/tags/v${PG_BIGM_VERSION}.tar.gz" \
 && echo "${PG_BIGM_SHA256}  /tmp/pg_bigm.tgz" | sha256sum -c - \
 && tar xzf /tmp/pg_bigm.tgz -C /tmp \
 && make -C "/tmp/pg_bigm-${PG_BIGM_VERSION}" USE_PGXS=1 \
 && make -C "/tmp/pg_bigm-${PG_BIGM_VERSION}" USE_PGXS=1 install DESTDIR=/out

FROM postgres:16.16-bookworm
COPY --from=build /out/ /
