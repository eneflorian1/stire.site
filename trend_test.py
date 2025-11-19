from pytrends.request import TrendReq
pytrends = TrendReq(hl="ro-RO", tz=120)
data = pytrends.realtime_trending_searches(pn="RO")
print(data.head())
