import fire

from nick_derobertis_site.common.cli.create import create_component


class Create:

    def component(self, name: str):
        create_component(name)


if __name__ == '__main__':
    fire.Fire({
        'create': Create
    })