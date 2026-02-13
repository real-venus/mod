
import mod as m
class Mod:
    description = """
    Base mod - Uniswap GraphQL scraper
    """

    def forward(self, mod='openclaw') -> int:
        schema = None
        error = None
        try:
            schema = m.schema(mod)
        except Exception as e:
            error = m.detailed_error(e)
        if schema != None:
            return schema
        readme =  m.readme()
        prompt = f"""The schema for this mod is not valid. 
        create a class in a file named src/mod.py with the following content:
        follow the readme to create the schema for this mod.
        {readme}

        if there is an error and if the file exists try to fix the environment if the error is related to that,
          otherwise fix the code. we aant the mod to be functional but it does not need to be perfect. 
          if there is an error try to fix it and make the mod functional, if there is an error related to the environment try to fix it by installing the required packages or fixing the imports. if there is an error related to the code try to fix it by modifying the code. if there is an error related to the schema try to fix it by modifying the schema. if there is an error related to the readme try to fix it by modifying the readme. if there is an error related to the prompt try to fix it by modifying the prompt. if there is an error related to something else try to fix it by modifying whatever is necessary.
          {error}

        feel free to use 
        the command and i prefer if you can fix it in one step for bonus points 
        user the cmd tool and dont create the file until you fix the environment if the error is related to that, otherwise create the file and fix the code until there is no error.
        """

        m.fn('dev/')(query=prompt, tools=['cmd'] if error else None, mod=mod)
        schema = m.schema(mod)
        return schema
