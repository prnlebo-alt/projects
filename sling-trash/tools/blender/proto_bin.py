import sys, os
sys.path.insert(0, os.path.dirname(__file__))
src = open(os.path.join(os.path.dirname(__file__), 'bl_assets.py')).read()
# run only the bin section of bl_assets
cut = src.index("def boss(name, open_lid):")
exec(compile(src[:cut], 'bl_assets_head', 'exec'))
bin_('bin_open_test', True, False); bin_('bin_closed_test', False, True)
