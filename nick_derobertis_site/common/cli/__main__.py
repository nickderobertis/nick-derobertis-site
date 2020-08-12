import fire

from nick_derobertis_site.common.cli.create import create_component


class Create:

    def component(self, name: str, output_dir: str = '.'):
        create_component(name, output_dir=output_dir)


if __name__ == '__main__':
    fire.Fire({
        'create': Create
    })