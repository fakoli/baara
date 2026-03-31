.PHONY: start cli typecheck clean

start:
	bun run src/index.ts

cli:
	bun run src/cli/index.ts $(ARGS)

typecheck:
	bunx tsc --noEmit

clean:
	rm -f data/*.db data/*.db-wal data/*.db-shm
