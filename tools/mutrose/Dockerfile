# Builds a native arm64 (or host-arch) Linux MutRoSe binary, to be run via
# tools/mutrose/mutrose-docker. Exists because the native macOS build
# (build-macos.sh) currently produces empty decompositions on some inputs —
# see the "macOS / Apple Silicon" README section for details — while a
# Linux build of the same commit works correctly.
FROM debian:bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libboost-all-dev bison flex git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG MUTROSE_REF=9e91d93
RUN git clone https://github.com/ericbg27/MutRoSe-Mission-Decomposer.git /src \
    && cd /src && git checkout "$MUTROSE_REF"

WORKDIR /src
# Upstream's makefile links -static (unsupported here) and -lboost_system
# (removed from Boost since 1.69; filesystem is the only lib still needed).
RUN sed -i 's/ -lboost_system//' makefile && make -j4
RUN cp MutroseMissionDecomposer /usr/local/bin/mutrose
