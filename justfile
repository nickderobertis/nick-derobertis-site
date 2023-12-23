run := ""
run-lint := "just run lint"
run-test := "just run root"
run-docs := "just run docs"

default:
    #!/usr/bin/env bash
    exit_code=0

    just format || ((exit_code++))
    just strip || ((exit_code++))
    just lint || ((exit_code++))
    just test || ((exit_code++))

    exit $exit_code

check:
    #!/usr/bin/env bash
    exit_code=0

    just format-check || ((exit_code++))
    just strip-check || ((exit_code++))
    just lint || ((exit_code++))
    just test || ((exit_code++))

    exit $exit_code


format *FILES='.':
    {{run}} isort {{FILES}}
    {{run}} black {{FILES}}

format-check *FILES='.':
    {{run}} isort --check-only {{FILES}}
    {{run}} black --check {{FILES}}

lint:
    {{run-lint}} flake8 --count --select=E9,F63,F7,F82 --show-source --statistics
    {{run-lint}} flake8 --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics
    {{run-lint}} mypy

strip-opts := "--remove-all-unused-imports --in-place --recursive --exclude=test*,__init__.py,venv*,build*,dist*,node_modules*"

strip *FILES='.':
    {{run}} autoflake {{strip-opts}} {{FILES}}

strip-check *FILES='.':
    {{run}} autoflake --check {{strip-opts}} {{FILES}}

test *OPTIONS:
    {{run-test}} pytest {{OPTIONS}}

test-coverage *OPTIONS:
    {{run-test}} pytest --cov=./ --cov-report=xml {{OPTIONS}}

docs-build:
    cd docsrc && {{run-docs}} make github

docs-serve:
    cd docsrc && {{run-docs}} ./dev-server.sh

docs:
    just docs-build
    just docs-serve

poetry command target *ARGS:
    #!/usr/bin/env bash
    cd {{invocation_directory()}}

    # Set the directory depending on whether the target is root or not
    if [ "{{target}}" = "root" ]; then
        DIRECTORY="{{justfile_directory()}}"
    else
        if [ ! -d "{{justfile_directory()}}/.venvs/{{target}}" ]; then
            echo "No such project environment {{target}}"
            exit 1;
        fi
        DIRECTORY="{{justfile_directory()}}/.venvs/{{target}}"
    fi

    if [ ! -d "${DIRECTORY}/.venv" ]; then
        echo "Creating virtual environment for {{target}}"

        poetry --directory $DIRECTORY install --all-extras
    fi
    poetry --directory $DIRECTORY {{command}} {{ARGS}}

run target *ARGS:
    @cd {{invocation_directory()}} && just poetry run {{target}} {{ARGS}}

# TODO: Can remove all the --no-root workarounds once poetry for applications is solved
#  See: https://github.com/python-poetry/poetry/issues/1132
poetry-all +ARGS:
    #!/usr/bin/env bash
    # Split args into command from the first argument
    # and the rest of the arguments, which should be empty if there is only a command
    IFS=' ' read -r command args <<< "{{ARGS}}"

    for target in root lint docs; do
        # If target is not root and command is install, need to add --no-root option
        if [ "$target" != "root" ] && [ "$command" = "install" ]; then
            full_args="--no-root $args"
        else
            full_args="$args"
        fi;
        echo "just poetry $command $target $full_args"
        just poetry $command $target $full_args
    done

sync *TARGET:
    #!/usr/bin/env bash
    # Handle specific target sync
    if [ ! -z "{{TARGET}}" ]; then
        # If target is not root, need to add --no-root option
        if [ "{{TARGET}}" != "root" ]; then
            just poetry install {{TARGET}} --all-extras --no-root --sync
            exit 0;
        fi

        just poetry install root --all-extras --sync
        exit 0;
    fi

    # Sync all
    just poetry-all install --all-extras --sync

inspect-build:
    rm -rf dist
    poetry build
    @echo "Contents of sdist:"
    @unzip -l dist/*.whl
    @echo "Contents of wheel:"
    @tar -tvf dist/*.tar.gz
