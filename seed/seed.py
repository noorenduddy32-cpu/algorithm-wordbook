# -*- coding: utf-8 -*-
"""生成 words 表的初始种子 SQL（来源：CSDN 博客《单词积累！》）。
运行后输出 seed.sql，用云数据库的 exec_sql(write) 执行即可。
"""
import json

DATA = [
    ("hack", "v.", "破解（比赛术语：hack 他人代码）", ["You can hack only if you solved all versions of this problem."], ""),
    ("arbitrary", "adj.", "任意的", ["choose an arbitrary integer m"], ""),
    ("denote", "v.", "表示，代表", ["Here, gcd(x,y) denotes the greatest common divisor (GCD) of integers x and y."], ""),
    ("portal", "n.", "大门，入口；（题中常指）传送门", ["There are also two portals located at positions x and y (x<y)."], ""),
    ("respectively", "adv.", "分别地", ["Using operation 1 on the left and right portals respectively results in the arrays [0,2,4,0,3,1] and [3,0,4,2,0,1]."], ""),
    ("lexicographically", "adv.", "按字典序地", ["Find the lexicographically smallest permutation you can obtain using these operations."], ""),
    ("lexicon", "n.", "词典，词汇表", [], "lexicographically（字典序地）的同根词"),
    ("index", "n.", "索引，下标（复数 indices / indexes）", ["A permutation a is lexicographically smaller than permutation b if there exists an index i such that aj=bj for all indices 1<=j<i and ai<bi."], "原题笔记里写成 indice，正确单数是 index，复数是 indices/indexes"),
    ("optimal", "adj.", "最优的", ["In the fourth test case, it is optimal not to do any operations."], ""),
    ("compute", "v.", "计算", ["you must compute a value for one sequence"], ""),
    ("terminate", "v.", "终止，结束", ["If k=0, terminate immediately and return the sequence x."], ""),
    ("immediately after", "phr.", "紧挨着，紧接着……之后", ["Then, select any index 1<=i<=|x| and insert (xi+1) immediately after the element xi."], ""),
    ("infer", "v.", "推断，推测", ["but it is not an easy job to infer the input from the output of the algorithm."], ""),
    ("separate", "adj.", "单独的，分开的", ["For each test case, output the length of the shortest sequence on a separate line."], ""),
    ("prefix", "n.", "前缀", ["x is a prefix of y, but x!=y"], ""),
    ("corresponding", "adj.", "对应的", ["the array x has a smaller element than the corresponding element in y."], ""),
    ("product", "n.", "乘积；（也指）产品", ["Let f(a) denote the number of subarrays of a whose product is divisible by 6."], ""),
    ("divisible", "adj.", "可整除的", ["Let f(a) denote the number of subarrays of a whose product is divisible by 6."], "be divisible by ... 可被……整除"),
    ("palindrome", "n.", "回文", ["A palindrome is a string that reads the same backward as forward, for example, strings \"z\", \"aaa\", \"aba\", \"abccba\" are palindromes, but strings \"codeforces\", \"reality\", \"ab\" are not."], ""),
    ("positive integer", "n.", "正整数", ["A positive integer x is a perfect root if there exists an integer y such that y=sqrt(x)."], ""),
    ("frosting", "n.", "（蛋糕上的）糖霜", ["so the frosting on the cake is uneven"], ""),
    ("uneven", "adj.", "不平坦的，不均匀的", ["so the frosting on the cake is uneven"], ""),
    ("level", "v./adj.", "使平整；水平的", ["To quickly solve this issue, Alice will put her knife at some integer height and then sweep the frosting from left to right to make the frosting level."], ""),
    ("bracket", "n.", "括号", ["We say that a bracket sequence a is better than a bracket sequence b if one of the following holds:"], ""),
    ("arithmetic", "n.", "算术", ["A regular bracket sequence is a bracket sequence that can be transformed into a correct arithmetic expression by inserting the characters 1 and + between the original characters of the sequence."], ""),
    ("hourglass", "n.", "沙漏", ["Vadim's hourglass measures s minutes."], ""),
    ("errand", "n.", "差事，跑腿", ["However, Vadim needs to leave for errands in m minutes"], "原句中是复数 errands，词条取原形"),
    ("proceed", "v.", "继续进行", ["After this, the game proceeds to the next turn, or ends if it is the n-th turn."], ""),
    ("if and only if", "phr.", "当且仅当", ["we call it complete if and only if both of the following hold:"], "常缩写为 iff"),
    ("ascending", "adj.", "升序的", ["Stepan wants to know whether it is possible to sort the permutation in ascending order using any number of such operations."], ""),
    ("lowercase", "n./adj.", "小写（字母）", ["You may output each letter in any case (lowercase or uppercase). For example, the strings \"yEs\", \"yes\", \"Yes\", and \"YES\" will be accepted."], ""),
    ("garland", "n.", "花环，彩灯串", ["Masha has a New Year garland consisting of n bulbs."], ""),
    ("bulb", "n.", "灯泡", ["Masha has a New Year garland consisting of n bulbs"], ""),
    ("binary", "adj.", "二进制的", ["The state of the garland is given by a binary string s of length n, where '0' denotes an off bulb and '1' denotes an on bulb."], ""),
    ("adjacent", "adj.", "相邻的", ["Masha considers the garland beautiful if the states of adjacent bulbs strictly alternate.", "For each 1<=i<n, positions i and i+1 are adjacent, and positions 1 and n are also adjacent."], ""),
    ("alternate", "adj./v.", "交替的；交替，轮流", ["Masha considers the garland beautiful if the states of adjacent bulbs strictly alternate."], ""),
    ("subsegment", "n.", "子段", ["Yura can apply the following operation to the garland: choose a subsegment and flip the state of all bulbs in it, that is, turn all on bulbs off and all off bulbs on."], "subarray 是子数组，subsegment 多见于字符串/序列题"),
    ("takeout", "n.", "外卖", ["A. Marisa Steals Reimu's Takeout"], ""),
    ("safeguard", "v.", "保护，保卫", ["Marisa is a girl of integrity who always helps others safeguard their belongings."], ""),
    ("fondness", "n.", "喜爱，癖好", ["Marisa has a special fondness for the number 3."], ""),
    ("concatenate", "v.", "连接，拼接", ["Delete and Concatenate", "After each operation, the remaining elements are concatenated without changing their relative order."], ""),
    ("relative", "adj.", "相对的", ["After each operation, the remaining elements are concatenated without changing their relative order."], ""),
    ("subtract", "v.", "减去", ["Every time you perform an operation (regardless of the type), c is subtracted from your score."], "原句是 subtracted，词条取原形"),
    ("partition", "n./v.", "划分，分区", ["Given an array a, let f(a) be the number of ways to partition a into one or more subarrays such that:"], ""),
]


def lit(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


rows = []
for word, pos, meaning, examples, note in DATA:
    ex = json.dumps(examples, ensure_ascii=False)
    rows.append(
        "(%s,%s,%s,$jq$%s$jq$::jsonb,%s)" % (lit(word), lit(pos), lit(meaning), ex, lit(note))
    )

sql = (
    "INSERT INTO words (word, pos, meaning, examples, note) VALUES\n"
    + ",\n".join(rows)
    + "\nON CONFLICT (word) DO NOTHING"
)

with open("seed.sql", "w", encoding="utf-8") as f:
    f.write(sql)

print("rows:", len(rows), "chars:", len(sql))
