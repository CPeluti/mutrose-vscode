with import <nixpkgs> {};
pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_18
    pkgs.which
    pkgs.htop
    pkgs.zlib
  ];
}
