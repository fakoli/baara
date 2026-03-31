.PHONY: start baara typecheck clean

start:
	bun run src/index.ts

baara:
	bun run src/cli/index.ts $(ARGS)

typecheck:
	bunx tsc --noEmit

clean:
	rm -f data/*.db data/*.db-wal data/*.db-shm
