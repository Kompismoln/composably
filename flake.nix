{
  description = "SvelteKit SSG";

  inputs = {
    nixpkgs.url = "github:kompismoln/nixpkgs/nixos-unstable";
  };

  outputs =
    {
      self,
      nixpkgs,
    }:
    let
      name = "composably";
      version = "0.0.1";
      src = ./.;
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {

      packages.${system}.default = pkgs.buildNpmPackage {
        pname = name;
        inherit version src;
        npmDeps = pkgs.importNpmLock { npmRoot = src; };
        npmConfigHook = pkgs.importNpmLock.npmConfigHook;
        nativeBuildInputs = [ pkgs.nodejs_23 ];

        buildPhase = ''
          npm run build
        '';

        installPhase = ''
          cp -r ./build $out
        '';

      };

      devShells.${system} = {
        default = pkgs.mkShell {
          name = "${name}-dev";
          packages = with pkgs; [
            # Dev shell for library maintainers only — not included in published package.
            (writeScriptBin "npm" ''pnpm "$@"'')
            (writeScriptBin "npx" ''echo "use pnpm dlx"'')
            pnpm
            node2nix
            nodejs_23
            nodePackages.svelte-language-server
            nodePackages.typescript-language-server
          ];
          shellHook = ''
            export DEBUG='composably*'
          '';
        };
      };
    };
}
